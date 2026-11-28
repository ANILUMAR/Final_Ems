package canteenManagment.main.dynamicmaster;

public class OptionItem {
    private String label;
    private String value;

    public OptionItem() {
    }

    public OptionItem(String label, String value) {
        this.label = label;
        this.value = value;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public String getValue() {
        return value;
    }

    public void setValue(String value) {
        this.value = value;
    }
}
