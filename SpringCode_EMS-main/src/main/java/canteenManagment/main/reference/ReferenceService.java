package canteenManagment.main.reference;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

/**
 * Reads and maintains the reference lists stored in {@code app_lookup}.
 *
 * <p>Every picker, chip and badge in the client is driven by this data, and the
 * server validates submitted values against the same rows - so adding a value
 * once in the database is enough for it to be offered, stored and rendered.</p>
 */
@Service
public class ReferenceService {

    public static final String ROLE = "ROLE";
    public static final String WORK_STATUS = "WORK_STATUS";
    public static final String PRIORITY = "PRIORITY";
    public static final String TIMESHEET_STATUS = "TIMESHEET_STATUS";
    public static final String PROJECT_STATUS = "PROJECT_STATUS";

    /** Stable order for the grouped payload and for admin screens. */
    public static final List<String> CATEGORIES =
            List.of(ROLE, WORK_STATUS, PRIORITY, TIMESHEET_STATUS, PROJECT_STATUS);

    private final LookupRepository repository;

    public ReferenceService(LookupRepository repository) {
        this.repository = repository;
    }

    public static String normalise(String category) {
        return String.valueOf(category == null ? "" : category).trim().toUpperCase(Locale.ROOT);
    }

    /** Live values of one list, in configured order. Cached until a write clears it. */
    @Cacheable(value = "lookups", key = "#category.toUpperCase()")
    public List<LookupItem> active(String category) {
        return repository.findByCategoryAndActiveTrueOrderBySortOrderAscLabelAsc(normalise(category));
    }

    /** The stored values only - what a validator or a guard needs. */
    public List<String> codes(String category) {
        return active(category).stream().map(LookupItem::getCode).collect(Collectors.toList());
    }

    public boolean isActiveCode(String category, String code) {
        if (code == null || code.trim().isEmpty()) {
            return false;
        }
        String wanted = code.trim().toUpperCase(Locale.ROOT);
        return active(category).stream()
                .anyMatch(item -> wanted.equals(String.valueOf(item.getCode()).toUpperCase(Locale.ROOT)));
    }

    /** Every list at once, so the client loads its whole vocabulary in one request. */
    @Cacheable(value = "lookups", key = "'ALL'")
    public Map<String, List<LookupItem>> all() {
        Map<String, List<LookupItem>> grouped = new LinkedHashMap<>();
        for (String category : CATEGORIES) {
            grouped.put(category, new ArrayList<>());
        }
        for (LookupItem item : repository.findByActiveTrueOrderByCategoryAscSortOrderAscLabelAsc()) {
            grouped.computeIfAbsent(normalise(item.getCategory()), key -> new ArrayList<>()).add(item);
        }
        return grouped;
    }

    /**
     * Creates or updates one value. Only the fields supplied by the caller are
     * replaced, so a partial edit keeps the icon the list already had.
     */
    @CacheEvict(value = "lookups", allEntries = true)
    public LookupItem save(String category, LookupItem incoming) {
        String list = normalise(category);
        if (!CATEGORIES.contains(list)) {
            throw new IllegalArgumentException("Unknown reference list: " + category);
        }
        if (incoming == null || incoming.getCode() == null || incoming.getCode().trim().isEmpty()) {
            throw new IllegalArgumentException("A code is required.");
        }
        String code = incoming.getCode().trim().toUpperCase(Locale.ROOT).replace(' ', '_');

        LookupItem item = repository.findByCategoryAndCodeIgnoreCase(list, code)
                .orElseGet(() -> new LookupItem(list, code, humanise(code), null, "neutral", nextSortOrder(list)));

        if (incoming.getLabel() != null && !incoming.getLabel().trim().isEmpty()) {
            item.setLabel(incoming.getLabel().trim());
        }
        if (incoming.getIcon() != null) {
            item.setIcon(incoming.getIcon().trim().isEmpty() ? null : incoming.getIcon().trim());
        }
        if (incoming.getTone() != null && !incoming.getTone().trim().isEmpty()) {
            item.setTone(incoming.getTone().trim().toLowerCase(Locale.ROOT));
        }
        if (incoming.getSortOrder() != null) {
            item.setSortOrder(incoming.getSortOrder());
        }
        if (incoming.getActive() != null) {
            item.setActive(incoming.getActive());
        }
        if (incoming.getSelectable() != null) {
            item.setSelectable(incoming.getSelectable());
        }
        return repository.save(item);
    }

    /**
     * Retires a value without deleting history: old rows keep rendering, the
     * pickers stop offering it.
     */
    @CacheEvict(value = "lookups", allEntries = true)
    public LookupItem setActive(String category, String code, boolean active) {
        String list = normalise(category);
        LookupItem item = repository.findByCategoryAndCodeIgnoreCase(list, code)
                .orElseThrow(() -> new IllegalArgumentException("Unknown " + list + " value: " + code));
        item.setActive(active);
        return repository.save(item);
    }

    private int nextSortOrder(String category) {
        return repository.findByCategoryOrderBySortOrderAsc(category).stream()
                .map(LookupItem::getSortOrder)
                .filter(java.util.Objects::nonNull)
                .max(Integer::compareTo)
                .orElse(0) + 10;
    }

    /** {@code IN_REVIEW} -> "In review", so a code added without a label still reads well. */
    private static String humanise(String code) {
        String[] words = code.toLowerCase(Locale.ROOT).split("_");
        StringBuilder text = new StringBuilder();
        for (String word : words) {
            if (word.isEmpty()) {
                continue;
            }
            if (text.length() > 0) {
                text.append(' ');
            }
            text.append(Character.toUpperCase(word.charAt(0))).append(word.substring(1));
        }
        return text.length() == 0 ? code : text.toString();
    }
}
