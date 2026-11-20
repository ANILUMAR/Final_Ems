package canteenManagment.main.UserEntity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
@Document(collection = "master_assignment_tbl")
public class MasterAssignmentTbl {

    @Id
    private Integer id;

    private String moduleDescription;

    private String processDescription;

    private String createDesc;

    // Getters and Setters
    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getModuleDescription() {
        return moduleDescription;
    }

    public void setModuleDescription(String moduleDescription) {
        this.moduleDescription = moduleDescription;
    }

    public String getProcessDescription() {
        return processDescription;
    }

    public void setProcessDescription(String processDescription) {
        this.processDescription = processDescription;
    }

    public String getCreateDesc() {
        return createDesc;
    }

    public void setCreateDesc(String createDesc) {
        this.createDesc = createDesc;
    }
}