package canteenManagment.main.reference;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * One selectable value of a reference list.
 *
 * <p>The Angular client no longer keeps its own copy of the roles, work statuses,
 * priorities, timesheet statuses or project statuses: every dropdown, chip and
 * badge is rendered from the documents in {@code app_lookup}. A new priority or
 * a renamed status is a row in this collection, not a code change.</p>
 *
 * <p>{@code id} is "{@code CATEGORY:CODE}" so seeding is an idempotent upsert and
 * a value can never appear twice in the same list.</p>
 */
@Document(collection = "app_lookup")
public class LookupItem {

    @Id
    private String id;

    /** ROLE, WORK_STATUS, PRIORITY, TIMESHEET_STATUS or PROJECT_STATUS. */
    @Indexed
    private String category;

    /** The value stored on business documents, e.g. {@code EMPLOYEE} or {@code HIGH}. */
    private String code;

    /** The word shown on screen, e.g. "Developer" or "High". */
    private String label;

    /** Material icon name, when the list is really a chip/board column. */
    private String icon;

    /** neutral | info | warning | success | danger - maps to ems-badge--{tone}. */
    private String tone;

    /** Lowest first. Ties fall back to the label. */
    private Integer sortOrder = 0;

    /**
     * Retired values stay in the collection so old rows still render; they are
     * only hidden from the pickers.
     */
    private Boolean active = Boolean.TRUE;

    /**
     * Whether this value may be chosen when creating something new. Approval
     * states such as APPROVED are real values that must render, but only an
     * approver sets them - so they are offered nowhere as a choice.
     *
     * Deliberately has no initialiser: a document written before the column
     * existed reads back as null, which is what the one-time migration looks
     * for. {@link #LookupItem(String, String, String, String, String, int)}
     * sets it explicitly for every new row.
     */
    private Boolean selectable;

    public LookupItem() {
    }

    public LookupItem(String category, String code, String label, String icon, String tone, int sortOrder) {
        this.id = key(category, code);
        this.category = category;
        this.code = code;
        this.label = label;
        this.icon = icon;
        this.tone = tone;
        this.sortOrder = sortOrder;
        this.active = Boolean.TRUE;
        this.selectable = Boolean.TRUE;
    }

    public static String key(String category, String code) {
        return String.valueOf(category).toUpperCase() + ":" + String.valueOf(code).toUpperCase();
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public String getIcon() {
        return icon;
    }

    public void setIcon(String icon) {
        this.icon = icon;
    }

    public String getTone() {
        return tone;
    }

    public void setTone(String tone) {
        this.tone = tone;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }

    public Boolean getActive() {
        return active;
    }

    public void setActive(Boolean active) {
        this.active = active;
    }

    public Boolean getSelectable() {
        return selectable;
    }

    public void setSelectable(Boolean selectable) {
        this.selectable = selectable;
    }
}
