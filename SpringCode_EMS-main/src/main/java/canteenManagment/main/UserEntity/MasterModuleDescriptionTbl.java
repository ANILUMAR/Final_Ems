package canteenManagment.main.UserEntity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.List;
@Document(collection = "master_module_description_tbl")
public class MasterModuleDescriptionTbl {
	

    @Id
    private Long moduleId;

    private String moduleDescription;

    // One module -> many submodules
    private List<MasterSubModuleDescriptionTbl> subModules;

    // One module -> many screens
    private List<MasterScreensTbl> screens;

	public Long getModuleId() {
		return moduleId;
	}

	public void setModuleId(Long moduleId) {
		this.moduleId = moduleId;
	}

	public String getModuleDescription() {
		return moduleDescription;
	}

	public void setModuleDescription(String moduleDescription) {
		this.moduleDescription = moduleDescription;
	}

	public List<MasterSubModuleDescriptionTbl> getSubModules() {
		return subModules;
	}

	public void setSubModules(List<MasterSubModuleDescriptionTbl> subModules) {
		this.subModules = subModules;
	}

	public List<MasterScreensTbl> getScreens() {
		return screens;
	}

	public void setScreens(List<MasterScreensTbl> screens) {
		this.screens = screens;
	}
    
    

}