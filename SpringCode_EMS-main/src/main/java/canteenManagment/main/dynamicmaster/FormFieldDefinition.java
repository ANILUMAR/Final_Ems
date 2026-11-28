package canteenManagment.main.dynamicmaster;

import java.util.ArrayList;
import java.util.List;

public class FormFieldDefinition {

    /** Field unique variable name/key, e.g. "deptCode", "employeeCount". */
    private String fieldKey;

    /** User-facing label, e.g. "Department Code". */
    private String fieldLabel;

    /**
     * Component type:
     * TEXT, TEXTAREA, NUMBER, DATE, SELECT, LOOKUP, TOGGLE, RADIO, EMAIL, PHONE, CURRENCY
     */
    private String fieldType;

    private String placeholder;
    private String hint;

    /** Responsive grid width span: 12 (full), 6 (half), 4 (one-third). */
    private Integer colSpan = 6;

    private Object defaultValue;

    /* Validation Rules */
    private Boolean required = Boolean.FALSE;
    private Integer minLength;
    private Integer maxLength;
    private Double min;
    private Double max;
    private String pattern;
    private String regexMessage;
    private Boolean unique = Boolean.FALSE;

    /* Dropdown / Select Configuration */
    private List<OptionItem> options = new ArrayList<>();

    /* Dynamic Lookup Configuration (linking to another master screen) */
    private String lookupScreenCode;
    private String lookupValueField; // field to store (e.g. "code" or "id")
    private String lookupLabelField; // field to display in dropdown (e.g. "name")

    /* Data Grid (Table) Configuration */
    private Boolean showInGrid = Boolean.TRUE;
    private Boolean filterable = Boolean.TRUE;
    private Boolean sortable = Boolean.TRUE;
    private Integer sortOrder = 0;

    public FormFieldDefinition() {
    }

    public String getFieldKey() {
        return fieldKey;
    }

    public void setFieldKey(String fieldKey) {
        this.fieldKey = fieldKey;
    }

    public String getFieldLabel() {
        return fieldLabel;
    }

    public void setFieldLabel(String fieldLabel) {
        this.fieldLabel = fieldLabel;
    }

    public String getFieldType() {
        return fieldType;
    }

    public void setFieldType(String fieldType) {
        this.fieldType = fieldType;
    }

    public String getPlaceholder() {
        return placeholder;
    }

    public void setPlaceholder(String placeholder) {
        this.placeholder = placeholder;
    }

    public String getHint() {
        return hint;
    }

    public void setHint(String hint) {
        this.hint = hint;
    }

    public Integer getColSpan() {
        return colSpan != null ? colSpan : 6;
    }

    public void setColSpan(Integer colSpan) {
        this.colSpan = colSpan;
    }

    public Object getDefaultValue() {
        return defaultValue;
    }

    public void setDefaultValue(Object defaultValue) {
        this.defaultValue = defaultValue;
    }

    public Boolean getRequired() {
        return required != null && required;
    }

    public void setRequired(Boolean required) {
        this.required = required;
    }

    public Integer getMinLength() {
        return minLength;
    }

    public void setMinLength(Integer minLength) {
        this.minLength = minLength;
    }

    public Integer getMaxLength() {
        return maxLength;
    }

    public void setMaxLength(Integer maxLength) {
        this.maxLength = maxLength;
    }

    public Double getMin() {
        return min;
    }

    public void setMin(Double min) {
        this.min = min;
    }

    public Double getMax() {
        return max;
    }

    public void setMax(Double max) {
        this.max = max;
    }

    public String getPattern() {
        return pattern;
    }

    public void setPattern(String pattern) {
        this.pattern = pattern;
    }

    public String getRegexMessage() {
        return regexMessage;
    }

    public void setRegexMessage(String regexMessage) {
        this.regexMessage = regexMessage;
    }

    public Boolean getUnique() {
        return unique != null && unique;
    }

    public void setUnique(Boolean unique) {
        this.unique = unique;
    }

    public List<OptionItem> getOptions() {
        return options != null ? options : new ArrayList<>();
    }

    public void setOptions(List<OptionItem> options) {
        this.options = options;
    }

    public String getLookupScreenCode() {
        return lookupScreenCode;
    }

    public void setLookupScreenCode(String lookupScreenCode) {
        this.lookupScreenCode = lookupScreenCode;
    }

    public String getLookupValueField() {
        return lookupValueField;
    }

    public void setLookupValueField(String lookupValueField) {
        this.lookupValueField = lookupValueField;
    }

    public String getLookupLabelField() {
        return lookupLabelField;
    }

    public void setLookupLabelField(String lookupLabelField) {
        this.lookupLabelField = lookupLabelField;
    }

    public Boolean getShowInGrid() {
        return showInGrid != null && showInGrid;
    }

    public void setShowInGrid(Boolean showInGrid) {
        this.showInGrid = showInGrid;
    }

    public Boolean getFilterable() {
        return filterable != null && filterable;
    }

    public void setFilterable(Boolean filterable) {
        this.filterable = filterable;
    }

    public Boolean getSortable() {
        return sortable != null && sortable;
    }

    public void setSortable(Boolean sortable) {
        this.sortable = sortable;
    }

    public Integer getSortOrder() {
        return sortOrder != null ? sortOrder : 0;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }
}
