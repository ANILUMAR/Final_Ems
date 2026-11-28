package canteenManagment.main.dynamicmaster;

import java.util.ArrayList;
import java.util.List;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * Definition of a dynamic master screen and its configured form fields.
 */
@Document(collection = "app_dynamic_form_schemas")
public class DynamicFormSchema {

    @Id
    private Long id;

    @Indexed(unique = true)
    private String screenCode;

    private String screenName;
    private String module;
    private String subModule;
    private String description;

    private List<FormFieldDefinition> fields = new ArrayList<>();

    private Boolean active = Boolean.TRUE;

    private String createdAt;
    private String createdBy;
    private String updatedAt;
    private String updatedBy;
    private Integer version = 1;

    public DynamicFormSchema() {
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

    public String getScreenName() {
        return screenName;
    }

    public void setScreenName(String screenName) {
        this.screenName = screenName;
    }

    public String getModule() {
        return module;
    }

    public void setModule(String module) {
        this.module = module;
    }

    public String getSubModule() {
        return subModule;
    }

    public void setSubModule(String subModule) {
        this.subModule = subModule;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public List<FormFieldDefinition> getFields() {
        return fields != null ? fields : new ArrayList<>();
    }

    public void setFields(List<FormFieldDefinition> fields) {
        this.fields = fields;
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

    public Integer getVersion() {
        return version != null ? version : 1;
    }

    public void setVersion(Integer version) {
        this.version = version;
    }
}
