package canteenManagment.main.UserEntity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.mapping.Document;
@Document(collection = "master_screens_tbl")
public class MasterScreensTbl {

    @Id
    private Long screenId;

    private String screenDescription;

    // Back-pointers to the owning module/submodule. They are not stored
    // (the parent already embeds its screens) and not serialised, which
    // keeps the parent -> child -> parent object graph acyclic.
    @Transient
    @JsonIgnore
    private MasterModuleDescriptionTbl module;

    // Many screens -> one submodule
    @Transient
    @JsonIgnore
    private MasterSubModuleDescriptionTbl subModule;

	public Long getScreenId() {
		return screenId;
	}

	public void setScreenId(Long screenId) {
		this.screenId = screenId;
	}

	public String getScreenDescription() {
		return screenDescription;
	}

	public void setScreenDescription(String screenDescription) {
		this.screenDescription = screenDescription;
	}

	public MasterModuleDescriptionTbl getModule() {
		return module;
	}

	public void setModule(MasterModuleDescriptionTbl module) {
		this.module = module;
	}

	public MasterSubModuleDescriptionTbl getSubModule() {
		return subModule;
	}

	public void setSubModule(MasterSubModuleDescriptionTbl subModule) {
		this.subModule = subModule;
	}
    
    
}