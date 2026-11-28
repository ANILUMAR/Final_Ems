package canteenManagment.main.dynamicmaster;

import java.util.HashMap;
import java.util.Map;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * A single data record inside any dynamic master screen.
 * The {@code data} map contains the dynamic key-value properties matching the schema fields.
 */
@Document(collection = "app_dynamic_master_records")
@CompoundIndexes({
    @CompoundIndex(name = "idx_screen_active", def = "{'screenCode': 1, 'active': 1}")
})
public class DynamicMasterRecord {

    @Id
    private Long id;

    private String screenCode;

    /** Dynamic field values keyed by FormFieldDefinition.fieldKey. */
    private Map<String, Object> data = new HashMap<>();

    private Boolean active = Boolean.TRUE;

    private String createdAt;
    private String createdBy;
    private String createdByName;

    private String updatedAt;
    private String updatedBy;
    private String updatedByName;

    public DynamicMasterRecord() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getScreenCode() {
        return screenCode;
    }

    public void setScreenCode(String screenCode) {
        this.screenCode = screenCode;
    }

    public Map<String, Object> getData() {
        return data != null ? data : new HashMap<>();
    }

    public void setData(Map<String, Object> data) {
        this.data = data;
    }

    public Boolean getActive() {
        return active != null && active;
    }

    public void setActive(Boolean active) {
        this.active = active;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public String getCreatedByName() {
        return createdByName;
    }

    public void setCreatedByName(String createdByName) {
        this.createdByName = createdByName;
    }

    public String getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(String updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getUpdatedBy() {
        return updatedBy;
    }

    public void setUpdatedBy(String updatedBy) {
        this.updatedBy = updatedBy;
    }

    public String getUpdatedByName() {
        return updatedByName;
    }

    public void setUpdatedByName(String updatedByName) {
        this.updatedByName = updatedByName;
    }
}
