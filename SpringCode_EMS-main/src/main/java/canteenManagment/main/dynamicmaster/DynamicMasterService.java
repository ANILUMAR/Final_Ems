package canteenManagment.main.dynamicmaster;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import javax.annotation.PostConstruct;

import canteenManagment.main.reference.LookupItem;
import canteenManagment.main.reference.LookupRepository;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.bson.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.stereotype.Service;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.FindOneAndUpdateOptions;
import com.mongodb.client.model.ReturnDocument;
import com.mongodb.client.model.Updates;

@Service
public class DynamicMasterService {

    private static final String COUNTERS_COLLECTION = "counters";
    private static final DateTimeFormatter ISO_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final DynamicFormSchemaRepository schemaRepository;
    private final DynamicMasterRecordRepository recordRepository;
    private final MongoDatabaseFactory databaseFactory;
    private final LookupRepository lookupRepository;
    private final CacheManager cacheManager;

    @Autowired
    public DynamicMasterService(
            DynamicFormSchemaRepository schemaRepository,
            DynamicMasterRecordRepository recordRepository,
            MongoDatabaseFactory databaseFactory,
            @Autowired(required = false) LookupRepository lookupRepository,
            @Autowired(required = false) CacheManager cacheManager) {
        this.schemaRepository = schemaRepository;
        this.recordRepository = recordRepository;
        this.databaseFactory = databaseFactory;
        this.lookupRepository = lookupRepository;
        this.cacheManager = cacheManager;
    }

    /* =========================================================================
     * ATOMIC ID GENERATION
     * ========================================================================= */

    public synchronized Long nextSequence(String key) {
        try {
            MongoDatabase db = databaseFactory.getMongoDatabase();
            MongoCollection<Document> counters = db.getCollection(COUNTERS_COLLECTION);
            Document updated = counters.findOneAndUpdate(
                    Filters.eq("_id", key),
                    Updates.inc("seq", 1L),
                    new FindOneAndUpdateOptions().upsert(true).returnDocument(ReturnDocument.AFTER));
            if (updated != null && updated.get("seq") instanceof Number) {
                return ((Number) updated.get("seq")).longValue();
            }
        } catch (Exception ex) {
            // fallback
        }
        return System.currentTimeMillis();
    }

    /* =========================================================================
     * SCHEMA MANAGEMENT
     * ========================================================================= */

    public DynamicFormSchema saveSchema(DynamicFormSchema input, String userEmail, String userName) {
        if (input == null) {
            throw new IllegalArgumentException("Schema definition cannot be empty.");
        }
        String screenCode = normalizeCode(input.getScreenCode());
        if (screenCode.isEmpty()) {
            throw new IllegalArgumentException("Screen Code is required (e.g. DEPT_MASTER, VENDOR_MASTER).");
        }
        String screenName = input.getScreenName() == null ? "" : input.getScreenName().trim();
        if (screenName.isEmpty()) {
            screenName = screenCode;
        }

        String now = LocalDateTime.now().format(ISO_FMT);
        String actor = (userName != null && !userName.trim().isEmpty()) ? userName : userEmail;

        Optional<DynamicFormSchema> existingOpt = schemaRepository.findByScreenCode(screenCode);
        DynamicFormSchema schema;

        if (existingOpt.isPresent()) {
            schema = existingOpt.get();
            schema.setScreenName(screenName);
            schema.setModule(input.getModule());
            schema.setSubModule(input.getSubModule());
            schema.setDescription(input.getDescription());
            schema.setFields(sanitizeFields(input.getFields()));
            schema.setActive(input.getActive() != null ? input.getActive() : Boolean.TRUE);
            schema.setUpdatedAt(now);
            schema.setUpdatedBy(actor);
            schema.setVersion((schema.getVersion() != null ? schema.getVersion() : 1) + 1);
        } else {
            schema = new DynamicFormSchema();
            schema.setId(nextSequence("seq_dynamic_schema"));
            schema.setScreenCode(screenCode);
            schema.setScreenName(screenName);
            schema.setModule(input.getModule());
            schema.setSubModule(input.getSubModule());
            schema.setDescription(input.getDescription());
            schema.setFields(sanitizeFields(input.getFields()));
            schema.setActive(Boolean.TRUE);
            schema.setCreatedAt(now);
            schema.setCreatedBy(actor);
            schema.setUpdatedAt(now);
            schema.setUpdatedBy(actor);
            schema.setVersion(1);
        }

        return schemaRepository.save(schema);
    }

    public Optional<DynamicFormSchema> getSchema(String screenCode) {
        if (screenCode == null) return Optional.empty();
        return schemaRepository.findByScreenCode(normalizeCode(screenCode));
    }

    public List<DynamicFormSchema> listSchemas() {
        return schemaRepository.findByActiveTrueOrderByScreenNameAsc();
    }

    public List<DynamicFormSchema> listSchemasByModule(String module) {
        if (module == null || module.trim().isEmpty()) {
            return listSchemas();
        }
        return schemaRepository.findByModuleAndActiveTrueOrderByScreenNameAsc(module.trim());
    }

    public void deleteSchema(String screenCode, boolean deleteRecords) {
        String code = normalizeCode(screenCode);
        Optional<DynamicFormSchema> opt = schemaRepository.findByScreenCode(code);
        if (opt.isPresent()) {
            DynamicFormSchema schema = opt.get();
            schema.setActive(Boolean.FALSE);
            schema.setUpdatedAt(LocalDateTime.now().format(ISO_FMT));
            schemaRepository.save(schema);

            if (deleteRecords) {
                recordRepository.deleteByScreenCode(code);
            }
        }
    }

    private List<FormFieldDefinition> sanitizeFields(List<FormFieldDefinition> fields) {
        if (fields == null) return new ArrayList<>();
        List<FormFieldDefinition> result = new ArrayList<>();
        int order = 1;
        for (FormFieldDefinition field : fields) {
            if (field == null) continue;
            String key = field.getFieldKey() == null ? "" : field.getFieldKey().trim().replaceAll("[^a-zA-Z0-9_]", "");
            if (key.isEmpty()) {
                key = "field_" + order;
            }
            field.setFieldKey(key);

            String label = field.getFieldLabel() == null ? "" : field.getFieldLabel().trim();
            if (label.isEmpty()) {
                field.setFieldLabel(key);
            }
            String type = field.getFieldType() == null ? "TEXT" : field.getFieldType().trim().toUpperCase(Locale.ROOT);
            field.setFieldType(type);
            field.setSortOrder(order++);
            result.add(field);
        }
        return result;
    }

    /* =========================================================================
     * RECORD CRUD & DYNAMIC DATA OPERATIONS
     * ========================================================================= */

    public DynamicMasterRecord saveRecord(String screenCode, Map<String, Object> data, String userEmail, String userName) {
        String code = normalizeCode(screenCode);
        DynamicFormSchema schema = schemaRepository.findByScreenCode(code)
                .orElseThrow(() -> new IllegalArgumentException("No schema defined for screen: " + screenCode));

        validateRecordData(schema, data, null);

        String now = LocalDateTime.now().format(ISO_FMT);
        String actor = (userName != null && !userName.trim().isEmpty()) ? userName : userEmail;

        DynamicMasterRecord record = new DynamicMasterRecord();
        record.setId(nextSequence("seq_dynamic_record_" + code.toLowerCase(Locale.ROOT)));
        record.setScreenCode(code);
        record.setData(cleanData(data));
        record.setActive(Boolean.TRUE);
        record.setCreatedAt(now);
        record.setCreatedBy(userEmail);
        record.setCreatedByName(actor);
        record.setUpdatedAt(now);
        record.setUpdatedBy(userEmail);
        record.setUpdatedByName(actor);

        DynamicMasterRecord saved = recordRepository.save(record);
        return saved;
    }

    public DynamicMasterRecord updateRecord(String screenCode, Long id, Map<String, Object> data, String userEmail, String userName) {
        String code = normalizeCode(screenCode);
        DynamicFormSchema schema = schemaRepository.findByScreenCode(code)
                .orElseThrow(() -> new IllegalArgumentException("No schema defined for screen: " + screenCode));

        DynamicMasterRecord record = recordRepository.findByIdAndScreenCode(id, code)
                .orElseThrow(() -> new IllegalArgumentException("Record #" + id + " not found in screen: " + screenCode));

        validateRecordData(schema, data, id);

        String now = LocalDateTime.now().format(ISO_FMT);
        String actor = (userName != null && !userName.trim().isEmpty()) ? userName : userEmail;

        record.setData(cleanData(data));
        record.setUpdatedAt(now);
        record.setUpdatedBy(userEmail);
        record.setUpdatedByName(actor);

        DynamicMasterRecord saved = recordRepository.save(record);
        return saved;
    }

    public Optional<DynamicMasterRecord> getRecord(String screenCode, Long id) {
        return recordRepository.findByIdAndScreenCode(id, normalizeCode(screenCode));
    }

    public void deleteRecord(String screenCode, Long id) {
        String code = normalizeCode(screenCode);
        Optional<DynamicMasterRecord> opt = recordRepository.findByIdAndScreenCode(id, code);
        if (opt.isPresent()) {
            DynamicMasterRecord record = opt.get();
            record.setActive(Boolean.FALSE);
            record.setUpdatedAt(LocalDateTime.now().format(ISO_FMT));
            recordRepository.save(record);
        }
    }

    public DynamicMasterPageResult<DynamicMasterRecord> listRecords(
            String screenCode, String search, int page, int size, String sortField, String sortDir) {

        String code = normalizeCode(screenCode);
        List<DynamicMasterRecord> all = recordRepository.findByScreenCodeAndActiveTrueOrderByIdDesc(code);

        // Search Filter
        if (search != null && !search.trim().isEmpty()) {
            String term = search.trim().toLowerCase(Locale.ROOT);
            all = all.stream().filter(rec -> matchesSearch(rec, term)).collect(Collectors.toList());
        }

        // Sorting
        final String sField = (sortField == null || sortField.trim().isEmpty()) ? "id" : sortField.trim();
        final boolean isAsc = "asc".equalsIgnoreCase(sortDir);

        Comparator<DynamicMasterRecord> comparator = (a, b) -> {
            if ("id".equals(sField)) {
                return Long.compare(a.getId() != null ? a.getId() : 0, b.getId() != null ? b.getId() : 0);
            }
            Object valA = a.getData() != null ? a.getData().get(sField) : null;
            Object valB = b.getData() != null ? b.getData().get(sField) : null;
            if (valA == null && valB == null) return 0;
            if (valA == null) return -1;
            if (valB == null) return 1;
            return String.valueOf(valA).compareToIgnoreCase(String.valueOf(valB));
        };

        if (!isAsc) {
            comparator = comparator.reversed();
        }
        all.sort(comparator);

        long totalElements = all.size();
        int safeSize = size <= 0 ? 10 : Math.min(size, 200);
        int totalPages = (int) Math.ceil((double) totalElements / safeSize);
        int safePage = Math.max(0, Math.min(page, Math.max(0, totalPages - 1)));

        int fromIndex = safePage * safeSize;
        int toIndex = Math.min(fromIndex + safeSize, all.size());
        List<DynamicMasterRecord> paged = fromIndex < all.size() ? all.subList(fromIndex, toIndex) : Collections.emptyList();

        return new DynamicMasterPageResult<>(paged, totalElements, totalPages, safePage, safeSize);
    }

    private boolean matchesSearch(DynamicMasterRecord record, String term) {
        if (String.valueOf(record.getId()).contains(term)) return true;
        if (record.getData() == null) return false;
        for (Object value : record.getData().values()) {
            if (value != null && String.valueOf(value).toLowerCase(Locale.ROOT).contains(term)) {
                return true;
            }
        }
        return false;
    }

    private Map<String, Object> cleanData(Map<String, Object> data) {
        if (data == null) return new HashMap<>();
        Map<String, Object> clean = new HashMap<>();
        for (Map.Entry<String, Object> entry : data.entrySet()) {
            if (entry.getKey() != null && !entry.getKey().trim().isEmpty()) {
                clean.put(entry.getKey().trim(), entry.getValue());
            }
        }
        return clean;
    }

    /* =========================================================================
     * VALIDATION ENGINE
     * ========================================================================= */

    private void validateRecordData(DynamicFormSchema schema, Map<String, Object> data, Long currentRecordId) {
        if (data == null) {
            data = Collections.emptyMap();
        }

        for (FormFieldDefinition field : schema.getFields()) {
            String key = field.getFieldKey();
            Object rawVal = data.get(key);
            String strVal = rawVal == null ? "" : String.valueOf(rawVal).trim();

            // Required Check
            if (field.getRequired() && strVal.isEmpty()) {
                throw new IllegalArgumentException(field.getFieldLabel() + " is required.");
            }

            if (!strVal.isEmpty()) {
                // Min/Max Length
                if (field.getMinLength() != null && strVal.length() < field.getMinLength()) {
                    throw new IllegalArgumentException(
                            field.getFieldLabel() + " must have at least " + field.getMinLength() + " characters.");
                }
                if (field.getMaxLength() != null && strVal.length() > field.getMaxLength()) {
                    throw new IllegalArgumentException(
                            field.getFieldLabel() + " must not exceed " + field.getMaxLength() + " characters.");
                }

                // Number Min/Max
                if ("NUMBER".equals(field.getFieldType()) || "CURRENCY".equals(field.getFieldType())) {
                    try {
                        double num = Double.parseDouble(strVal);
                        if (field.getMin() != null && num < field.getMin()) {
                            throw new IllegalArgumentException(
                                    field.getFieldLabel() + " must be at least " + field.getMin() + ".");
                        }
                        if (field.getMax() != null && num > field.getMax()) {
                            throw new IllegalArgumentException(
                                    field.getFieldLabel() + " must not exceed " + field.getMax() + ".");
                        }
                    } catch (NumberFormatException nfe) {
                        throw new IllegalArgumentException(field.getFieldLabel() + " must be a valid number.");
                    }
                }

                // Pattern / Regex
                if (field.getPattern() != null && !field.getPattern().trim().isEmpty()) {
                    try {
                        if (!Pattern.matches(field.getPattern().trim(), strVal)) {
                            String msg = field.getRegexMessage() != null && !field.getRegexMessage().trim().isEmpty()
                                    ? field.getRegexMessage().trim()
                                    : (field.getFieldLabel() + " format is invalid.");
                            throw new IllegalArgumentException(msg);
                        }
                    } catch (Exception ex) {
                        if (ex instanceof IllegalArgumentException) throw (IllegalArgumentException) ex;
                    }
                }

                // Unique Constraint
                if (field.getUnique()) {
                    List<DynamicMasterRecord> existingRecords =
                            recordRepository.findByScreenCodeAndActiveTrueOrderByIdDesc(schema.getScreenCode());
                    boolean duplicateExists = existingRecords.stream()
                            .filter(r -> currentRecordId == null || !Objects.equals(r.getId(), currentRecordId))
                            .anyMatch(r -> {
                                Object existingVal = r.getData() != null ? r.getData().get(key) : null;
                                return existingVal != null && strVal.equalsIgnoreCase(String.valueOf(existingVal).trim());
                            });
                    if (duplicateExists) {
                        throw new IllegalArgumentException(
                                field.getFieldLabel() + " value '" + strVal + "' already exists. It must be unique.");
                    }
                }
            }
        }
    }

    /* =========================================================================
     * LOOKUP PROVIDER (Cross-master Dynamic Dropdowns)
     * ========================================================================= */

    public List<Map<String, Object>> getLookupOptions(String screenCode) {
        String code = normalizeCode(screenCode);
        Optional<DynamicFormSchema> schemaOpt = schemaRepository.findByScreenCode(code);
        if (schemaOpt.isEmpty()) {
            return Collections.emptyList();
        }
        DynamicFormSchema schema = schemaOpt.get();

        // Find primary display fields (default to first 2 visible fields if not configured)
        String valueField = "id";
        String labelField = "name";

        List<FormFieldDefinition> fields = schema.getFields();
        for (FormFieldDefinition f : fields) {
            String k = f.getFieldKey().toLowerCase(Locale.ROOT);
            if (k.contains("code") || k.equals("id")) {
                valueField = f.getFieldKey();
            }
            if (k.contains("name") || k.contains("title") || k.contains("label")) {
                labelField = f.getFieldKey();
            }
        }

        List<DynamicMasterRecord> records = recordRepository.findByScreenCodeAndActiveTrueOrderByIdDesc(code);
        List<Map<String, Object>> options = new ArrayList<>();

        for (DynamicMasterRecord r : records) {
            Map<String, Object> opt = new LinkedHashMap<>();
            Object val = (r.getData() != null && r.getData().containsKey(valueField))
                    ? r.getData().get(valueField)
                    : r.getId();
            Object lbl = (r.getData() != null && r.getData().containsKey(labelField))
                    ? r.getData().get(labelField)
                    : (val != null ? val : ("Record #" + r.getId()));

            opt.put("value", val != null ? String.valueOf(val) : String.valueOf(r.getId()));
            opt.put("label", lbl != null ? String.valueOf(lbl) : ("Record #" + r.getId()));
            opt.put("id", r.getId());
            opt.put("data", r.getData());
            options.add(opt);
        }
        return options;
    }

    /* =========================================================================
     * EXCEL EXPORT
     * ========================================================================= */

    public byte[] exportExcel(String screenCode) throws IOException {
        String code = normalizeCode(screenCode);
        DynamicFormSchema schema = schemaRepository.findByScreenCode(code)
                .orElseThrow(() -> new IllegalArgumentException("No schema defined for screen: " + screenCode));

        List<DynamicMasterRecord> records = recordRepository.findByScreenCodeAndActiveTrueOrderByIdDesc(code);
        List<FormFieldDefinition> gridFields = schema.getFields().stream()
                .filter(FormFieldDefinition::getShowInGrid)
                .collect(Collectors.toList());

        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet(schema.getScreenName() != null ? schema.getScreenName() : "Master Data");

            // Header Style
            CellStyle headerStyle = workbook.createCellStyle();
            Font font = workbook.createFont();
            font.setBold(true);
            font.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(font);
            headerStyle.setFillForegroundColor(IndexedColors.ROYAL_BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(HorizontalAlignment.LEFT);

            // Header Row
            Row headerRow = sheet.createRow(0);
            int colIdx = 0;
            Cell idCell = headerRow.createCell(colIdx++);
            idCell.setCellValue("Record ID");
            idCell.setCellStyle(headerStyle);

            for (FormFieldDefinition f : gridFields) {
                Cell cell = headerRow.createCell(colIdx++);
                cell.setCellValue(f.getFieldLabel());
                cell.setCellStyle(headerStyle);
            }

            Cell createdCell = headerRow.createCell(colIdx++);
            createdCell.setCellValue("Created At");
            createdCell.setCellStyle(headerStyle);

            // Data Rows
            int rowIdx = 1;
            for (DynamicMasterRecord rec : records) {
                Row row = sheet.createRow(rowIdx++);
                colIdx = 0;
                row.createCell(colIdx++).setCellValue(rec.getId() != null ? rec.getId() : 0);

                for (FormFieldDefinition f : gridFields) {
                    Object val = rec.getData() != null ? rec.getData().get(f.getFieldKey()) : "";
                    row.createCell(colIdx++).setCellValue(val != null ? String.valueOf(val) : "");
                }

                row.createCell(colIdx++).setCellValue(rec.getCreatedAt() != null ? rec.getCreatedAt() : "");
            }

            for (int i = 0; i < colIdx; i++) {
                sheet.autoSizeColumn(i);
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            workbook.write(out);
            return out.toByteArray();
        }
    }

    private String normalizeCode(String code) {
        if (code == null) return "";
        return code.trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9_]", "_");
    }

    /* =========================================================================
     * CORE REUSABLE MASTER AUTO-SEEDING
     * ========================================================================= */

    @PostConstruct
    public void initCoreMasterSchemas() {
        // Clean up ROLE_MASTER schema & records if present
        try {
            schemaRepository.findByScreenCode("ROLE_MASTER").ifPresent(s -> {
                schemaRepository.delete(s);
                recordRepository.deleteByScreenCode("ROLE_MASTER");
            });
        } catch (Exception ignored) {}

        initModuleScreenMasterSchema();
        initOrganizationMasterSchema();
    }

    /* =========================================================================
     * MODULE, SUBMODULE & SCREEN MASTER AUTO-SEEDING
     * ========================================================================= */

    public void initModuleScreenMasterSchema() {
        try {
            if (!schemaRepository.existsByScreenCode("MODULE_SCREEN_MASTER")) {
                DynamicFormSchema schema = new DynamicFormSchema();
                schema.setId(nextSequence("seq_dynamic_schema"));
                schema.setScreenCode("MODULE_SCREEN_MASTER");
                schema.setScreenName("Module, Submodule & Screen Master");
                schema.setModule("Administration");
                schema.setSubModule("System Setup");
                schema.setDescription("Dynamic Master for defining application modules, submodules, screens, route paths, and navigation icons.");
                schema.setActive(Boolean.TRUE);
                String now = LocalDateTime.now().format(ISO_FMT);
                schema.setCreatedAt(now);
                schema.setCreatedBy("system");
                schema.setUpdatedAt(now);
                schema.setUpdatedBy("system");
                schema.setVersion(1);

                List<FormFieldDefinition> fields = new ArrayList<>();

                FormFieldDefinition f1 = new FormFieldDefinition();
                f1.setFieldKey("moduleName");
                f1.setFieldLabel("Module Name");
                f1.setFieldType("TEXT");
                f1.setPlaceholder("e.g. Overview, Work, Delivery, Administration");
                f1.setColSpan(6);
                f1.setRequired(true);
                f1.setMinLength(2);
                f1.setMaxLength(60);
                f1.setShowInGrid(true);
                f1.setFilterable(true);
                f1.setSortable(true);
                f1.setSortOrder(1);
                fields.add(f1);

                FormFieldDefinition f2 = new FormFieldDefinition();
                f2.setFieldKey("submoduleName");
                f2.setFieldLabel("Sub-Module Name");
                f2.setFieldType("TEXT");
                f2.setPlaceholder("e.g. Tickets, Setup, Review");
                f2.setColSpan(6);
                f2.setShowInGrid(true);
                f2.setFilterable(true);
                f2.setSortable(true);
                f2.setSortOrder(2);
                fields.add(f2);

                FormFieldDefinition f3 = new FormFieldDefinition();
                f3.setFieldKey("screenCode");
                f3.setFieldLabel("Screen Code");
                f3.setFieldType("TEXT");
                f3.setPlaceholder("e.g. DASHBOARD, TASK_LIST");
                f3.setHint("Uppercase alphanumeric identifier");
                f3.setColSpan(6);
                f3.setRequired(true);
                f3.setUnique(true);
                f3.setPattern("^[A-Z0-9_]+$");
                f3.setRegexMessage("Only uppercase letters, digits, and underscores allowed");
                f3.setShowInGrid(true);
                f3.setFilterable(true);
                f3.setSortable(true);
                f3.setSortOrder(3);
                fields.add(f3);

                FormFieldDefinition f4 = new FormFieldDefinition();
                f4.setFieldKey("screenName");
                f4.setFieldLabel("Screen Display Name");
                f4.setFieldType("TEXT");
                f4.setPlaceholder("e.g. Executive Dashboard, All Tickets Registry");
                f4.setColSpan(6);
                f4.setRequired(true);
                f4.setMinLength(3);
                f4.setMaxLength(80);
                f4.setShowInGrid(true);
                f4.setFilterable(true);
                f4.setSortable(true);
                f4.setSortOrder(4);
                fields.add(f4);

                FormFieldDefinition f5 = new FormFieldDefinition();
                f5.setFieldKey("routePath");
                f5.setFieldLabel("Route Path");
                f5.setFieldType("TEXT");
                f5.setPlaceholder("e.g. /dashboard, /tasks, /audit-logs");
                f5.setColSpan(6);
                f5.setRequired(true);
                f5.setShowInGrid(true);
                f5.setFilterable(true);
                f5.setSortable(true);
                f5.setSortOrder(5);
                fields.add(f5);

                FormFieldDefinition f6 = new FormFieldDefinition();
                f6.setFieldKey("icon");
                f6.setFieldLabel("Material Icon");
                f6.setFieldType("TEXT");
                f6.setPlaceholder("e.g. space_dashboard, bug_report, tune");
                f6.setColSpan(6);
                f6.setShowInGrid(true);
                f6.setFilterable(false);
                f6.setSortable(true);
                f6.setSortOrder(6);
                fields.add(f6);

                FormFieldDefinition f7 = new FormFieldDefinition();
                f7.setFieldKey("sortOrder");
                f7.setFieldLabel("Display Sort Order");
                f7.setFieldType("NUMBER");
                f7.setColSpan(6);
                f7.setMin(1.0);
                f7.setMax(999.0);
                f7.setDefaultValue(10);
                f7.setShowInGrid(true);
                f7.setSortable(true);
                f7.setSortOrder(7);
                fields.add(f7);

                FormFieldDefinition f8 = new FormFieldDefinition();
                f8.setFieldKey("description");
                f8.setFieldLabel("Screen Purpose & Notes");
                f8.setFieldType("TEXTAREA");
                f8.setPlaceholder("Describe functional responsibilities and expected workflow role...");
                f8.setColSpan(12);
                f8.setMaxLength(300);
                f8.setShowInGrid(false);
                f8.setSortOrder(8);
                fields.add(f8);

                FormFieldDefinition f9 = new FormFieldDefinition();
                f9.setFieldKey("isActive");
                f9.setFieldLabel("Active Status");
                f9.setFieldType("TOGGLE");
                f9.setColSpan(6);
                f9.setDefaultValue(true);
                f9.setShowInGrid(true);
                f9.setFilterable(true);
                f9.setSortable(true);
                f9.setSortOrder(9);
                fields.add(f9);

                schema.setFields(sanitizeFields(fields));
                schemaRepository.save(schema);

                seedDefaultModuleScreenRecords(now);
            } else if (recordRepository.countByScreenCodeAndActiveTrue("MODULE_SCREEN_MASTER") == 0) {
                seedDefaultModuleScreenRecords(LocalDateTime.now().format(ISO_FMT));
            }
        } catch (Exception ex) {
            System.err.println("Notice: Could not auto-seed MODULE_SCREEN_MASTER schema: " + ex.getMessage());
        }
    }

    private void seedDefaultModuleScreenRecords(String timestamp) {
        saveModuleScreenRecord("Overview", "Executive", "DASHBOARD", "Executive Dashboard", "/dashboard", "space_dashboard", 10, "Executive statistics, analytics, and operational overview.", timestamp);
        saveModuleScreenRecord("Overview", "Engineering", "DEVELOPER_BOARD", "Development Board", "/developer-board", "code", 20, "Developer team task board and active development pipeline.", timestamp);
        saveModuleScreenRecord("Overview", "QA Testing", "TESTER_BOARD", "QA Testing Board", "/tester-board", "bug_report", 30, "QA testing dashboard and verification pipeline.", timestamp);
        saveModuleScreenRecord("Work", "Intake", "RAISE_TICKET", "Create Issue", "/issues/new", "add_circle", 40, "Submit new task or bug with reproduction flow and steps.", timestamp);
        saveModuleScreenRecord("Work", "Tickets", "TICKET_HUB", "Ticket Hub", "/tasks/all", "view_quilt", 50, "Unified console for ticket review, assignment, and triage.", timestamp);
        saveModuleScreenRecord("Delivery", "Projects", "PROJECT_OVERVIEW", "Projects Overview", "/projects", "insights", 60, "Overview of all active projects, health, and team members.", timestamp);
        saveModuleScreenRecord("Administration", "Enterprise", "ORGANIZATION_MASTER", "Organization Master", "/dynamic-masters/view/ORGANIZATION_MASTER", "corporate_fare", 80, "Enterprise organization master for managing client corporations and subsidiaries.", timestamp);
        saveModuleScreenRecord("Administration", "System Setup", "MODULE_SCREEN_MASTER", "Module & Screen Master", "/dynamic-masters/view/MODULE_SCREEN_MASTER", "account_tree", 90, "Dynamic Master for application modules, submodules, and screens.", timestamp);
    }

    private void saveModuleScreenRecord(String module, String submodule, String screenCode, String screenName,
                                        String routePath, String icon, int sortOrder, String desc, String timestamp) {
        DynamicMasterRecord rec = new DynamicMasterRecord();
        rec.setId(nextSequence("seq_dynamic_record_module_screen_master"));
        rec.setScreenCode("MODULE_SCREEN_MASTER");
        rec.setActive(Boolean.TRUE);
        rec.setCreatedAt(timestamp);
        rec.setCreatedBy("system");
        rec.setCreatedByName("System Seeder");
        rec.setUpdatedAt(timestamp);
        rec.setUpdatedBy("system");
        rec.setUpdatedByName("System Seeder");

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("moduleName", module);
        data.put("submoduleName", submodule);
        data.put("screenCode", screenCode);
        data.put("screenName", screenName);
        data.put("routePath", routePath);
        data.put("icon", icon);
        data.put("sortOrder", sortOrder);
        data.put("description", desc);
        data.put("isActive", true);
        rec.setData(data);

        recordRepository.save(rec);
    }

    /* =========================================================================
     * ORGANIZATION MASTER AUTO-SEEDING
     * ========================================================================= */

    public void initOrganizationMasterSchema() {
        try {
            if (!schemaRepository.existsByScreenCode("ORGANIZATION_MASTER")) {
                DynamicFormSchema schema = new DynamicFormSchema();
                schema.setId(nextSequence("seq_dynamic_schema"));
                schema.setScreenCode("ORGANIZATION_MASTER");
                schema.setScreenName("Organization Master");
                schema.setModule("Administration");
                schema.setSubModule("Enterprise Setup");
                schema.setDescription("Enterprise organization master for managing client corporations, subsidiaries, branches, and business units.");
                schema.setActive(Boolean.TRUE);
                String now = LocalDateTime.now().format(ISO_FMT);
                schema.setCreatedAt(now);
                schema.setCreatedBy("system");
                schema.setUpdatedAt(now);
                schema.setUpdatedBy("system");
                schema.setVersion(1);

                List<FormFieldDefinition> fields = new ArrayList<>();

                FormFieldDefinition f1 = new FormFieldDefinition();
                f1.setFieldKey("orgCode");
                f1.setFieldLabel("Organization Code");
                f1.setFieldType("TEXT");
                f1.setPlaceholder("e.g. ORG_HQ, ACME_CORP");
                f1.setHint("Uppercase alphanumeric code");
                f1.setColSpan(6);
                f1.setRequired(true);
                f1.setUnique(true);
                f1.setPattern("^[A-Z0-9_]+$");
                f1.setRegexMessage("Only uppercase letters, digits, and underscores allowed");
                f1.setShowInGrid(true);
                f1.setFilterable(true);
                f1.setSortable(true);
                f1.setSortOrder(1);
                fields.add(f1);

                FormFieldDefinition f2 = new FormFieldDefinition();
                f2.setFieldKey("orgName");
                f2.setFieldLabel("Organization Name");
                f2.setFieldType("TEXT");
                f2.setPlaceholder("e.g. Enterprise Global Systems Inc.");
                f2.setColSpan(6);
                f2.setRequired(true);
                f2.setMinLength(2);
                f2.setMaxLength(120);
                f2.setShowInGrid(true);
                f2.setFilterable(true);
                f2.setSortable(true);
                f2.setSortOrder(2);
                fields.add(f2);

                FormFieldDefinition f3 = new FormFieldDefinition();
                f3.setFieldKey("orgType");
                f3.setFieldLabel("Organization Type");
                f3.setFieldType("SELECT");
                f3.setColSpan(6);
                f3.setRequired(true);
                f3.setDefaultValue("Headquarters");
                f3.setShowInGrid(true);
                f3.setFilterable(true);
                f3.setSortable(true);
                f3.setSortOrder(3);
                List<OptionItem> f3Options = new ArrayList<>();
                f3Options.add(new OptionItem("Headquarters", "Headquarters"));
                f3Options.add(new OptionItem("Regional Hub", "Regional Hub"));
                f3Options.add(new OptionItem("Subsidiary", "Subsidiary"));
                f3Options.add(new OptionItem("Client Enterprise", "Client Enterprise"));
                f3Options.add(new OptionItem("Vendor Partner", "Vendor Partner"));
                f3.setOptions(f3Options);
                fields.add(f3);

                FormFieldDefinition f4 = new FormFieldDefinition();
                f4.setFieldKey("registrationNo");
                f4.setFieldLabel("Registration / Tax ID");
                f4.setFieldType("TEXT");
                f4.setPlaceholder("e.g. CIN-U72200TN2020PTC123456");
                f4.setColSpan(6);
                f4.setShowInGrid(true);
                f4.setFilterable(true);
                f4.setSortable(true);
                f4.setSortOrder(4);
                fields.add(f4);

                FormFieldDefinition f5 = new FormFieldDefinition();
                f5.setFieldKey("contactEmail");
                f5.setFieldLabel("Corporate Contact Email");
                f5.setFieldType("EMAIL");
                f5.setPlaceholder("contact@organization.com");
                f5.setColSpan(6);
                f5.setRequired(true);
                f5.setShowInGrid(true);
                f5.setFilterable(true);
                f5.setSortable(true);
                f5.setSortOrder(5);
                fields.add(f5);

                FormFieldDefinition f6 = new FormFieldDefinition();
                f6.setFieldKey("contactPhone");
                f6.setFieldLabel("Contact Phone");
                f6.setFieldType("PHONE");
                f6.setPlaceholder("e.g. 9876543210");
                f6.setColSpan(6);
                f6.setShowInGrid(true);
                f6.setFilterable(false);
                f6.setSortable(false);
                f6.setSortOrder(6);
                fields.add(f6);

                FormFieldDefinition f7 = new FormFieldDefinition();
                f7.setFieldKey("city");
                f7.setFieldLabel("City / Location");
                f7.setFieldType("TEXT");
                f7.setPlaceholder("e.g. Chennai, Bangalore, New York");
                f7.setColSpan(6);
                f7.setShowInGrid(true);
                f7.setFilterable(true);
                f7.setSortable(true);
                f7.setSortOrder(7);
                fields.add(f7);

                FormFieldDefinition f8 = new FormFieldDefinition();
                f8.setFieldKey("country");
                f8.setFieldLabel("Country");
                f8.setFieldType("SELECT");
                f8.setColSpan(6);
                f8.setDefaultValue("India");
                f8.setShowInGrid(true);
                f8.setFilterable(true);
                f8.setSortable(true);
                f8.setSortOrder(8);
                List<OptionItem> f8Options = new ArrayList<>();
                f8Options.add(new OptionItem("India", "India"));
                f8Options.add(new OptionItem("United States", "United States"));
                f8Options.add(new OptionItem("United Kingdom", "United Kingdom"));
                f8Options.add(new OptionItem("Singapore", "Singapore"));
                f8Options.add(new OptionItem("Germany", "Germany"));
                f8Options.add(new OptionItem("Australia", "Australia"));
                f8Options.add(new OptionItem("Canada", "Canada"));
                f8.setOptions(f8Options);
                fields.add(f8);

                FormFieldDefinition f9 = new FormFieldDefinition();
                f9.setFieldKey("website");
                f9.setFieldLabel("Website URL");
                f9.setFieldType("TEXT");
                f9.setPlaceholder("https://www.example.com");
                f9.setColSpan(6);
                f9.setShowInGrid(false);
                f9.setSortOrder(9);
                fields.add(f9);

                FormFieldDefinition f10 = new FormFieldDefinition();
                f10.setFieldKey("maxUsers");
                f10.setFieldLabel("Maximum User Accounts");
                f10.setFieldType("NUMBER");
                f10.setColSpan(6);
                f10.setMin(1.0);
                f10.setMax(50000.0);
                f10.setDefaultValue(100);
                f10.setShowInGrid(true);
                f10.setSortable(true);
                f10.setSortOrder(10);
                fields.add(f10);

                FormFieldDefinition f11 = new FormFieldDefinition();
                f11.setFieldKey("description");
                f11.setFieldLabel("Enterprise Charter & Profile");
                f11.setFieldType("TEXTAREA");
                f11.setPlaceholder("Enter company details, industry vertical, and operational profile...");
                f11.setColSpan(12);
                f11.setMaxLength(500);
                f11.setShowInGrid(false);
                f11.setSortOrder(11);
                fields.add(f11);

                FormFieldDefinition f12 = new FormFieldDefinition();
                f12.setFieldKey("isActive");
                f12.setFieldLabel("Active Status");
                f12.setFieldType("TOGGLE");
                f12.setColSpan(6);
                f12.setDefaultValue(true);
                f12.setShowInGrid(true);
                f12.setFilterable(true);
                f12.setSortable(true);
                f12.setSortOrder(12);
                fields.add(f12);

                schema.setFields(sanitizeFields(fields));
                schemaRepository.save(schema);

                seedDefaultOrganizationRecords(now);
            } else if (recordRepository.countByScreenCodeAndActiveTrue("ORGANIZATION_MASTER") == 0) {
                seedDefaultOrganizationRecords(LocalDateTime.now().format(ISO_FMT));
            }
        } catch (Exception ex) {
            System.err.println("Notice: Could not auto-seed ORGANIZATION_MASTER schema: " + ex.getMessage());
        }
    }

    private void seedDefaultOrganizationRecords(String timestamp) {
        saveOrganizationRecord("ORG_GLOBAL_HQ", "EMS Global Technologies Corp.", "Headquarters", "REG-IND-9901", "corporate@ems.com", "9876543210", "Chennai", "India", 5000, "Enterprise headquarters managing corporate operations.", timestamp);
        saveOrganizationRecord("ORG_US_EAST", "EMS Americas Inc.", "Subsidiary", "US-DE-44120", "americas@ems.com", "9876543211", "New York", "United States", 1200, "Americas regional operating hub and client service facility.", timestamp);
        saveOrganizationRecord("ORG_APAC_HUB", "EMS Asia Pacific Pte Ltd", "Regional Hub", "SG-UEN-2021001", "apac@ems.com", "9876543212", "Singapore", "Singapore", 800, "Asia-Pacific delivery operations and technology consulting.", timestamp);
    }

    private void saveOrganizationRecord(String orgCode, String orgName, String orgType, String regNo,
                                        String email, String phone, String city, String country,
                                        int maxUsers, String desc, String timestamp) {
        DynamicMasterRecord rec = new DynamicMasterRecord();
        rec.setId(nextSequence("seq_dynamic_record_organization_master"));
        rec.setScreenCode("ORGANIZATION_MASTER");
        rec.setActive(Boolean.TRUE);
        rec.setCreatedAt(timestamp);
        rec.setCreatedBy("system");
        rec.setCreatedByName("System Seeder");
        rec.setUpdatedAt(timestamp);
        rec.setUpdatedBy("system");
        rec.setUpdatedByName("System Seeder");

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("orgCode", orgCode);
        data.put("orgName", orgName);
        data.put("orgType", orgType);
        data.put("registrationNo", regNo);
        data.put("contactEmail", email);
        data.put("contactPhone", phone);
        data.put("city", city);
        data.put("country", country);
        data.put("maxUsers", maxUsers);
        data.put("description", desc);
        data.put("isActive", true);
        rec.setData(data);

        recordRepository.save(rec);
    }
}
