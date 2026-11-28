package canteenManagment.main.rbac;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Initializes default role-based screen access configurations on application startup.
 * If MongoDB has no records for an assignable role, its default configuration is seeded.
 */
@Component
@Order(2)
public class RolePermissionInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(RolePermissionInitializer.class);

    private final RolePermissionService rolePermissionService;

    public RolePermissionInitializer(RolePermissionService rolePermissionService) {
        this.rolePermissionService = rolePermissionService;
    }

    @Override
    public void run(ApplicationArguments args) {
        log.info("Checking and seeding default role-based screen permissions if missing...");
        try {
            List<RolePermissionConfig> configs = rolePermissionService.getAllConfigs();
            log.info("Initialized role-based screen permissions for {} roles successfully.", configs.size());
        } catch (Exception e) {
            log.error("Failed to initialize role permissions: {}", e.getMessage(), e);
        }
    }
}
