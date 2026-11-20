package canteenManagment.main.master;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

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
}
