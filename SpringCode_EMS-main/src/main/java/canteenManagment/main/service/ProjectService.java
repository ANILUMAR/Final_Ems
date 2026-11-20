package canteenManagment.main.service;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import canteenManagment.main.UserEntity.MasterProjectTbl;
import canteenManagment.main.UserEntity.Project;
import canteenManagment.main.userReposerity.MasterProjectRepository;
import canteenManagment.main.userReposerity.ProjectRepository;

@Service
public class ProjectService {
    @Autowired private ProjectRepository projectRepo;

    // The legacy pickers (/api/assigntasks/getAllProjects, totalProjects) read
    // master_project_tbl, so a project is written to both collections.
    @Autowired private MasterProjectRepository masterProjectRepo;

    public List<Project> findAll() {
        return projectRepo.findAll();
    }

    /**
     * Creates a project together with its master-table mirror so it immediately
     * appears in the portfolio, the project picker and the project counter.
     *
     * @throws IllegalArgumentException when the name is blank
     * @throws IllegalStateException    when a project with that name already exists
     */
    public Project create(Project project) {
        String name = project.getName() == null ? "" : project.getName().trim();
        if (name.isEmpty()) {
            throw new IllegalArgumentException("Project name is required.");
        }
        if (projectRepo.findFirstByNameIgnoreCase(name).isPresent()) {
            throw new IllegalStateException("A project named \"" + name + "\" already exists.");
        }

        // Let NumericIdCallback hand out the next id instead of trusting the payload.
        project.setId(null);
        project.setName(name);
        if (project.getDescription() != null) {
            project.setDescription(project.getDescription().trim());
        }

        Project saved = projectRepo.save(project);
        syncMasterProject(saved.getName());
        return saved;
    }

    private void syncMasterProject(String name) {
        MasterProjectTbl master = masterProjectRepo.findFirstByProjectNameIgnoreCase(name)
                .orElseGet(MasterProjectTbl::new);
        master.setProjectName(name);
        master.setIsActive(true);
        masterProjectRepo.save(master);
    }
}
