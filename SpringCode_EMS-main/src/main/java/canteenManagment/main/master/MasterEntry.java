package canteenManagment.main.master;

import java.util.List;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * One entry of the module / sub module / screen master data.
 *
 * <p>The three lists form a small tree: a screen belongs to a sub module, and a
 * sub module belongs to a module. They are kept as flat documents with a
 * {@code parentId} rather than nested arrays so that adding, renaming or
 * retiring a single value never rewrites a whole subtree.</p>
 *
 * <p>The tasks themselves keep storing the three names as plain strings, so a
 * value can be renamed or retired without touching work already recorded.</p>
 */
@Document(collection = "app_master_data")
public class MasterEntry {

    public static final String MODULE = "MODULE";
    public static final String SUB_MODULE = "SUB_MODULE";
    public static final String SCREEN = "SCREEN";

    /** The three lists, in the order they are meant to be filled in. */
    public static final List<String> TYPES = List.of(MODULE, SUB_MODULE, SCREEN);

    @Id
    private Long id;

    /** One of {@link #TYPES}. */
    private String type;

    /** What the admin typed, shown in the pickers. */
    private String name;

    /** The parent entry: null for a module, a module for a sub module, a sub module for a screen. */
    private Long parentId;

    /** Retired entries stay readable on old tasks but are no longer offered. */
    private Boolean active = Boolean.TRUE;

    /** Kept in the order the admin added the values. */
    private Integer sortOrder;

    public MasterEntry() {
    }

    public MasterEntry(String type, String name, Long parentId, Integer sortOrder) {
        this.type = type;
        this.name = name;
        this.parentId = parentId;
        this.sortOrder = sortOrder;
        this.active = Boolean.TRUE;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Long getParentId() {
        return parentId;
    }

    public void setParentId(Long parentId) {
        this.parentId = parentId;
    }

    public Boolean getActive() {
        return active;
    }

    public void setActive(Boolean active) {
        this.active = active;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }

    public boolean isActive() {
        return !Boolean.FALSE.equals(active);
    }
}
