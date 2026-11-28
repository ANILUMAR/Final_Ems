package canteenManagment.main.master;

import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
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
import org.springframework.web.multipart.MultipartFile;

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

    /**
     * Uploads and parses an Excel (.xlsx or .xls) file containing Module, Sub-Module,
     * and Screen rows, saving them into the database.
     */
    @PostMapping(value = "/upload-excel", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadExcel(@RequestParam("file") MultipartFile file, Authentication authentication) {
        if (!userService.canEditMasters(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Only the company administrator can change the master data.");
        }
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body("Please select a non-empty Excel file.");
        }
        String filename = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        if (!filename.endsWith(".xlsx") && !filename.endsWith(".xls")) {
            return ResponseEntity.badRequest().body("Invalid file type. Please upload an Excel (.xlsx or .xls) file.");
        }
        try {
            return ResponseEntity.ok(masterDataService.importExcel(file.getInputStream()));
        } catch (Exception ex) {
            return ResponseEntity.badRequest().body("Failed to process Excel file: " + ex.getMessage());
        }
    }

    /**
     * Bulk imports a list of (module, subModule, screen) maps.
     */
    @PostMapping("/bulk")
    public ResponseEntity<?> importBulk(@RequestBody List<Map<String, String>> rows, Authentication authentication) {
        if (!userService.canEditMasters(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Only the company administrator can change the master data.");
        }
        try {
            return ResponseEntity.ok(masterDataService.importRows(rows));
        } catch (Exception ex) {
            return ResponseEntity.badRequest().body("Bulk import failed: " + ex.getMessage());
        }
    }

    /**
     * Downloads an Excel (.xlsx) template with pre-configured headers and sample rows.
     */
    @GetMapping("/excel-template")
    public ResponseEntity<byte[]> downloadTemplate() {
        byte[] bytes = masterDataService.generateExcelTemplate();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"Module_Screen_Setup_Template.xlsx\"")
                .header(HttpHeaders.CONTENT_TYPE, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                .body(bytes);
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
