package canteenManagment.main.master;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

/**
 * Reads and maintains the module / sub module / screen master data.
 *
 * <p>This is the only writer of {@code app_master_data}. The create and edit
 * task screens read their three pickers from here, and the legacy
 * {@code /api/assigntasks/get*Description} endpoints are served from the same
 * lists, so a value added once is offered everywhere.</p>
 */
@Service
public class MasterDataService {

    public static class ExcelImportResult {
        private int totalRows;
        private int modulesProcessed;
        private int subModulesProcessed;
        private int screensProcessed;
        private List<String> warnings = new ArrayList<>();
        private Map<String, List<MasterEntry>> data;

        public int getTotalRows() {
            return totalRows;
        }

        public void setTotalRows(int totalRows) {
            this.totalRows = totalRows;
        }

        public int getModulesProcessed() {
            return modulesProcessed;
        }

        public void setModulesProcessed(int modulesProcessed) {
            this.modulesProcessed = modulesProcessed;
        }

        public int getSubModulesProcessed() {
            return subModulesProcessed;
        }

        public void setSubModulesProcessed(int subModulesProcessed) {
            this.subModulesProcessed = subModulesProcessed;
        }

        public int getScreensProcessed() {
            return screensProcessed;
        }

        public void setScreensProcessed(int screensProcessed) {
            this.screensProcessed = screensProcessed;
        }

        public List<String> getWarnings() {
            return warnings;
        }

        public void setWarnings(List<String> warnings) {
            this.warnings = warnings;
        }

        public Map<String, List<MasterEntry>> getData() {
            return data;
        }

        public void setData(Map<String, List<MasterEntry>> data) {
            this.data = data;
        }
    }

    private final MasterEntryRepository repository;

    public MasterDataService(MasterEntryRepository repository) {
        this.repository = repository;
    }

    public static String normaliseType(String type) {
        return String.valueOf(type == null ? "" : type).trim().toUpperCase(Locale.ROOT);
    }

    /** Every live entry, grouped by list. One request fills the whole screen. */
    public Map<String, List<MasterEntry>> all() {
        Map<String, List<MasterEntry>> grouped = new LinkedHashMap<>();
        for (String type : MasterEntry.TYPES) {
            grouped.put(type, active(type));
        }
        return grouped;
    }

    /** One list, in the order the admin created the values. */
    public List<MasterEntry> active(String type) {
        return repository.findByTypeAndActiveTrueOrderBySortOrderAscNameAsc(normaliseType(type));
    }

    /** Just the words - what the task pickers and the legacy endpoints need. */
    public List<String> names(String type) {
        return active(type).stream().map(MasterEntry::getName).collect(Collectors.toList());
    }

    /** The sub modules of one module, or the screens of one sub module. */
    public List<MasterEntry> children(String type, Long parentId) {
        if (parentId == null) {
            return new ArrayList<>();
        }
        return active(type).stream()
                .filter(entry -> parentId.equals(entry.getParentId()))
                .collect(Collectors.toList());
    }

    /**
     * Creates a value, or renames/reactivates the one with the same name under
     * the same parent. The parent decides where a value belongs: a sub module
     * needs a module, a screen needs a sub module.
     */
    public MasterEntry save(String type, String name, Long parentId) {
        String list = normaliseType(type);
        if (!MasterEntry.TYPES.contains(list)) {
            throw new IllegalArgumentException("Unknown master list: " + type);
        }
        String value = String.valueOf(name == null ? "" : name).trim();
        if (value.isEmpty()) {
            throw new IllegalArgumentException("A name is required.");
        }
        if (value.length() > 120) {
            throw new IllegalArgumentException("Keep the name under 120 characters.");
        }

        Long parent = validateParent(list, parentId);

        Optional<MasterEntry> existing = repository.findByTypeOrderBySortOrderAscNameAsc(list).stream()
                .filter(entry -> java.util.Objects.equals(entry.getParentId(), parent))
                .filter(entry -> entry.getName() != null && entry.getName().trim().equalsIgnoreCase(value))
                .findFirst();

        if (existing.isPresent()) {
            MasterEntry entry = existing.get();
            // Saying the same name twice is a no-op; it also un-retires a value
            // that was switched off earlier, which is what the admin means.
            entry.setName(value);
            entry.setActive(Boolean.TRUE);
            return repository.save(entry);
        }

        int sortOrder = repository.findByTypeOrderBySortOrderAscNameAsc(list).stream()
                .map(MasterEntry::getSortOrder)
                .filter(java.util.Objects::nonNull)
                .max(Comparator.naturalOrder())
                .orElse(0) + 10;

        return repository.save(new MasterEntry(list, value, parent, sortOrder));
    }

    /**
     * Retires a value. Its children are retired with it, otherwise the task
     * screen would keep offering a screen whose sub module is gone.
     */
    public MasterEntry setActive(Long id, boolean active) {
        MasterEntry entry = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Master data entry " + id + " does not exist."));
        entry.setActive(active);
        MasterEntry saved = repository.save(entry);

        if (!active) {
            String childType = childTypeOf(entry.getType());
            if (childType != null) {
                for (MasterEntry child : repository.findByParentId(entry.getId())) {
                    child.setActive(Boolean.FALSE);
                    repository.save(child);
                    setActive(child.getId(), false);
                }
            }
        }
        return saved;
    }

    /** A module owns sub modules, a sub module owns screens. */
    private Long validateParent(String type, Long parentId) {
        if (MasterEntry.MODULE.equals(type)) {
            if (parentId != null) {
                throw new IllegalArgumentException("A module does not belong to anything.");
            }
            return null;
        }
        String expected = MasterEntry.SUB_MODULE.equals(type) ? MasterEntry.MODULE : MasterEntry.SUB_MODULE;
        if (parentId == null) {
            throw new IllegalArgumentException(
                    (MasterEntry.SUB_MODULE.equals(type) ? "A sub module" : "A screen") + " needs a parent.");
        }
        MasterEntry parent = repository.findByIdAndActiveTrue(parentId)
                .orElseThrow(() -> new IllegalArgumentException("The parent value no longer exists."));
        if (!expected.equals(normaliseType(parent.getType()))) {
            throw new IllegalArgumentException(
                    (MasterEntry.SUB_MODULE.equals(type) ? "A sub module" : "A screen")
                            + " belongs to a " + expected.toLowerCase(Locale.ROOT).replace('_', ' ') + ".");
        }
        return parent.getId();
    }

    private static String childTypeOf(String type) {
        String list = normaliseType(type);
        if (MasterEntry.MODULE.equals(list)) {
            return MasterEntry.SUB_MODULE;
        }
        return MasterEntry.SUB_MODULE.equals(list) ? MasterEntry.SCREEN : null;
    }

    /**
     * Parses an uploaded Excel (.xlsx or .xls) file and imports Modules, Sub-Modules,
     * and Screens into the database.
     */
    public ExcelImportResult importExcel(InputStream inputStream) {
        ExcelImportResult result = new ExcelImportResult();
        try (Workbook workbook = WorkbookFactory.create(inputStream)) {
            if (workbook.getNumberOfSheets() == 0) {
                result.getWarnings().add("The uploaded Excel workbook contains no sheets.");
                return result;
            }
            Sheet sheet = workbook.getSheetAt(0);
            DataFormatter formatter = new DataFormatter();

            int headerRowNum = -1;
            int colModule = -1;
            int colSubModule = -1;
            int colScreen = -1;

            int maxCheckRows = Math.min(sheet.getLastRowNum(), 15);
            for (int r = sheet.getFirstRowNum(); r <= maxCheckRows; r++) {
                Row row = sheet.getRow(r);
                if (row == null) continue;
                for (int c = 0; c < row.getLastCellNum(); c++) {
                    String val = formatter.formatCellValue(row.getCell(c)).trim().toLowerCase(Locale.ROOT);
                    if (val.contains("sub") && (val.contains("mod") || val.contains("module"))) {
                        colSubModule = c;
                    } else if (val.contains("module") || val.equals("mod")) {
                        if (colModule == -1) colModule = c;
                    } else if (val.contains("screen") || val.contains("page")) {
                        colScreen = c;
                    }
                }
                if (colModule != -1) {
                    headerRowNum = r;
                    break;
                }
            }

            if (colModule == -1) {
                colModule = 0;
                colSubModule = 1;
                colScreen = 2;
                headerRowNum = -1;
            }

            int startRow = (headerRowNum >= 0) ? headerRowNum + 1 : sheet.getFirstRowNum();
            for (int r = startRow; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null) continue;

                String moduleName = colModule >= 0 ? formatter.formatCellValue(row.getCell(colModule)).trim() : "";
                String subModuleName = colSubModule >= 0 ? formatter.formatCellValue(row.getCell(colSubModule)).trim() : "";
                String screenName = colScreen >= 0 ? formatter.formatCellValue(row.getCell(colScreen)).trim() : "";

                if (moduleName.isEmpty() && subModuleName.isEmpty() && screenName.isEmpty()) {
                    continue;
                }

                result.setTotalRows(result.getTotalRows() + 1);

                try {
                    MasterEntry moduleEntry = null;
                    if (!moduleName.isEmpty()) {
                        moduleEntry = save(MasterEntry.MODULE, moduleName, null);
                        result.setModulesProcessed(result.getModulesProcessed() + 1);
                    }

                    MasterEntry subModuleEntry = null;
                    if (!subModuleName.isEmpty()) {
                        if (moduleEntry == null) {
                            result.getWarnings().add("Row " + (r + 1) + ": Sub-Module '" + subModuleName + "' skipped because Module is missing.");
                        } else {
                            subModuleEntry = save(MasterEntry.SUB_MODULE, subModuleName, moduleEntry.getId());
                            result.setSubModulesProcessed(result.getSubModulesProcessed() + 1);
                        }
                    }

                    if (!screenName.isEmpty()) {
                        if (subModuleEntry == null) {
                            result.getWarnings().add("Row " + (r + 1) + ": Screen '" + screenName + "' skipped because Sub-Module is missing.");
                        } else {
                            save(MasterEntry.SCREEN, screenName, subModuleEntry.getId());
                            result.setScreensProcessed(result.getScreensProcessed() + 1);
                        }
                    }
                } catch (Exception ex) {
                    result.getWarnings().add("Row " + (r + 1) + " error: " + ex.getMessage());
                }
            }
            result.setData(all());
        } catch (Exception e) {
            throw new IllegalArgumentException("Failed to read Excel file: " + e.getMessage(), e);
        }
        return result;
    }

    /**
     * Imports structured rows of (module, subModule, screen) into the database.
     */
    public ExcelImportResult importRows(List<Map<String, String>> rows) {
        ExcelImportResult result = new ExcelImportResult();
        if (rows == null || rows.isEmpty()) {
            result.getWarnings().add("No rows provided for import.");
            return result;
        }

        for (int i = 0; i < rows.size(); i++) {
            Map<String, String> row = rows.get(i);
            if (row == null) continue;

            String moduleName = String.valueOf(row.getOrDefault("module", row.getOrDefault("Module", ""))).trim();
            String subModuleName = String.valueOf(row.getOrDefault("subModule", row.getOrDefault("Sub Module", row.getOrDefault("sub_module", "")))).trim();
            String screenName = String.valueOf(row.getOrDefault("screen", row.getOrDefault("Screen", ""))).trim();

            if (moduleName.isEmpty() && subModuleName.isEmpty() && screenName.isEmpty()) {
                continue;
            }

            result.setTotalRows(result.getTotalRows() + 1);
            try {
                MasterEntry moduleEntry = null;
                if (!moduleName.isEmpty()) {
                    moduleEntry = save(MasterEntry.MODULE, moduleName, null);
                    result.setModulesProcessed(result.getModulesProcessed() + 1);
                }

                MasterEntry subModuleEntry = null;
                if (!subModuleName.isEmpty()) {
                    if (moduleEntry == null) {
                        result.getWarnings().add("Row " + (i + 1) + ": Sub-Module '" + subModuleName + "' skipped because Module is missing.");
                    } else {
                        subModuleEntry = save(MasterEntry.SUB_MODULE, subModuleName, moduleEntry.getId());
                        result.setSubModulesProcessed(result.getSubModulesProcessed() + 1);
                    }
                }

                if (!screenName.isEmpty()) {
                    if (subModuleEntry == null) {
                        result.getWarnings().add("Row " + (i + 1) + ": Screen '" + screenName + "' skipped because Sub-Module is missing.");
                    } else {
                        save(MasterEntry.SCREEN, screenName, subModuleEntry.getId());
                        result.setScreensProcessed(result.getScreensProcessed() + 1);
                    }
                }
            } catch (Exception ex) {
                result.getWarnings().add("Row " + (i + 1) + " error: " + ex.getMessage());
            }
        }
        result.setData(all());
        return result;
    }

    /**
     * Generates a pre-formatted Excel (.xlsx) template for bulk Module, Sub-Module, and Screen setup.
     */
    public byte[] generateExcelTemplate() {
        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("Module_Screen_Setup");

            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.ROYAL_BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(HorizontalAlignment.LEFT);

            Row headerRow = sheet.createRow(0);
            String[] headers = {"Module", "Sub Module", "Screen"};
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            String[][] sampleData = {
                {"Employee Management", "Authentication", "Login Screen"},
                {"Employee Management", "Authentication", "Registration Screen"},
                {"Employee Management", "Authentication", "Forgot Password"},
                {"Employee Management", "Profile", "View Profile"},
                {"Employee Management", "Profile", "Edit Profile"},
                {"Delivery Management", "Ticket Board", "Task Board"},
                {"Delivery Management", "Ticket Board", "Swimlanes View"},
                {"Delivery Management", "Review Pipeline", "Approval Queue"},
                {"Timesheets", "Daily Entry", "Submit Timesheet"},
                {"Timesheets", "Approvals", "Timesheet Approvals"}
            };

            for (int r = 0; r < sampleData.length; r++) {
                Row row = sheet.createRow(r + 1);
                for (int c = 0; c < sampleData[r].length; c++) {
                    row.createCell(c).setCellValue(sampleData[r][c]);
                }
            }

            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
                sheet.setColumnWidth(i, Math.max(sheet.getColumnWidth(i) + 1200, 6000));
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            workbook.write(baos);
            return baos.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Could not generate Excel template", e);
        }
    }
}
