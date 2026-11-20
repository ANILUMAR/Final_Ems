package canteenManagment.main.UserEntity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.mapping.Document;


import java.util.List;
@Document(collection = "master_submodule_description_tbl")
public class MasterSubModuleDescriptionTbl {

    @Id
    private Long subModuleId;

    private String subModuleDescription;

    // Owner reference only; the module embeds its submodules, so storing the
    // pointer as well would create a cycle.
    @Transient
    @JsonIgnore
    private MasterModuleDescriptionTbl module;

    private List<MasterScreensTbl> screens;

	public Long getSubModuleId() {
		return subModuleId;
	}

	public void setSubModuleId(Long subModuleId) {
		this.subModuleId = subModuleId;
	}

	public String getSubModuleDescription() {
		return subModuleDescription;
	}

	public void setSubModuleDescription(String subModuleDescription) {
		this.subModuleDescription = subModuleDescription;
	}

	public MasterModuleDescriptionTbl getModule() {
		return module;
	}

	public void setModule(MasterModuleDescriptionTbl module) {
		this.module = module;
	}

	public List<MasterScreensTbl> getScreens() {
		return screens;
	}

	public void setScreens(List<MasterScreensTbl> screens) {
		this.screens = screens;
	}
    
    
}