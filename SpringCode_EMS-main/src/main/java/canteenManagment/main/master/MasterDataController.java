package canteenManagment.main.master;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import canteenManagment.main.service.UserService;

/**
 * The module / sub module / screen master data.
 *
 * <p>Reading is open to any signed-in account: the create and edit task screens
 * need the lists, and they are only the names of parts of the product. Writing
 * is the CEO's alone - mapping the product is administrative work - and is
 * checked again here on every request.</p>
 */
@RestController
@RequestMapping("/api/masters")
public class MasterDataController {

    private final MasterDataService masterDataService;
    private final UserService userService;

    public MasterDataController(MasterDataService masterDataService, UserService userService) {
        this.masterDataService = masterDataService;
        this.userService = userService;
    }

    /** All three lists at once, keyed by MODULE / SUB_MODULE / SCREEN. */
    @GetMapping
    public ResponseEntity<Map<String, List<MasterEntry>>> all() {
        return ResponseEntity.ok(masterDataService.all());
    }

    /** The sub modules of one module, or the screens of one sub module. */
    @GetMapping("/{type}")
    public ResponseEntity<List<MasterEntry>> children(@PathVariable String type, @RequestParam Long parentId) {
        return ResponseEntity.ok(masterDataService.children(type, parentId));
    }

    /**
     * Creates a value. The body carries {@code type}, {@code name} and - for a
     * sub module or a screen - the {@code parentId} it belongs to.
     */
    @PostMapping
    public ResponseEntity<?> save(@RequestBody MasterEntry request, Authentication authentication) {
        if (!userService.canEditMasters(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Only the company administrator can change the master data.");
        }
        try {
            return ResponseEntity.ok(masterDataService.save(
                    request == null ? null : request.getType(),
                    request == null ? null : request.getName(),
                    request == null ? null : request.getParentId()));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    /** Retires a value (and everything under it); recorded work keeps rendering. */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> retire(@PathVariable Long id, Authentication authentication) {
        if (!userService.canEditMasters(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Only the company administrator can change the master data.");
        }
        try {
            return ResponseEntity.ok(masterDataService.setActive(id, false));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ex.getMessage());
        }
    }
}
