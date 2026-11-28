package canteenManagment.main.dynamicmaster;

import java.io.IOException;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import canteenManagment.main.service.UserService;

@RestController
@RequestMapping("/api/dynamic-masters")
public class DynamicMasterController {

    private final DynamicMasterService dynamicMasterService;
    private final UserService userService;

    @Autowired
    public DynamicMasterController(DynamicMasterService dynamicMasterService, UserService userService) {
        this.dynamicMasterService = dynamicMasterService;
        this.userService = userService;
    }

    /* =========================================================================
     * SCHEMA ENDPOINTS
     * ========================================================================= */

    @GetMapping("/schemas")
    public ResponseEntity<List<DynamicFormSchema>> listSchemas(@RequestParam(required = false) String module) {
        if (module != null && !module.trim().isEmpty()) {
            return ResponseEntity.ok(dynamicMasterService.listSchemasByModule(module));
        }
        return ResponseEntity.ok(dynamicMasterService.listSchemas());
    }

    @GetMapping("/schemas/{screenCode}")
    public ResponseEntity<?> getSchema(@PathVariable String screenCode) {
        return dynamicMasterService.getSchema(screenCode)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Schema not found for screen: " + screenCode));
    }

    @PostMapping("/schemas")
    public ResponseEntity<?> saveSchema(@RequestBody DynamicFormSchema schema, Authentication authentication) {
        if (!userService.canEditMasters(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Only administrators can create or update dynamic master schemas.");
        }
        try {
            String email = authentication != null ? authentication.getName() : "admin";
            return ResponseEntity.ok(dynamicMasterService.saveSchema(schema, email, email));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    @DeleteMapping("/schemas/{screenCode}")
    public ResponseEntity<?> deleteSchema(
            @PathVariable String screenCode,
            @RequestParam(defaultValue = "false") boolean deleteRecords,
            Authentication authentication) {
        if (!userService.canEditMasters(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Only administrators can delete master schemas.");
        }
        dynamicMasterService.deleteSchema(screenCode, deleteRecords);
        return ResponseEntity.ok(Map.of("message", "Schema deleted successfully"));
    }

    /* =========================================================================
     * RECORD DATA ENDPOINTS
     * ========================================================================= */

    @GetMapping("/records/{screenCode}")
    public ResponseEntity<DynamicMasterPageResult<DynamicMasterRecord>> listRecords(
            @PathVariable String screenCode,
            @RequestParam(required = false, defaultValue = "") String search,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "10") int size,
            @RequestParam(required = false, defaultValue = "id") String sortField,
            @RequestParam(required = false, defaultValue = "desc") String sortDir) {

        return ResponseEntity.ok(dynamicMasterService.listRecords(screenCode, search, page, size, sortField, sortDir));
    }

    @GetMapping("/records/{screenCode}/{id}")
    public ResponseEntity<?> getRecord(@PathVariable String screenCode, @PathVariable Long id) {
        return dynamicMasterService.getRecord(screenCode, id)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Record #" + id + " not found in screen: " + screenCode));
    }

    @PostMapping("/records/{screenCode}")
    public ResponseEntity<?> saveRecord(
            @PathVariable String screenCode,
            @RequestBody Map<String, Object> data,
            Authentication authentication) {
        try {
            String email = authentication != null ? authentication.getName() : "user";
            return ResponseEntity.ok(dynamicMasterService.saveRecord(screenCode, data, email, email));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    @PutMapping("/records/{screenCode}/{id}")
    public ResponseEntity<?> updateRecord(
            @PathVariable String screenCode,
            @PathVariable Long id,
            @RequestBody Map<String, Object> data,
            Authentication authentication) {
        try {
            String email = authentication != null ? authentication.getName() : "user";
            return ResponseEntity.ok(dynamicMasterService.updateRecord(screenCode, id, data, email, email));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    @DeleteMapping("/records/{screenCode}/{id}")
    public ResponseEntity<?> deleteRecord(@PathVariable String screenCode, @PathVariable Long id) {
        dynamicMasterService.deleteRecord(screenCode, id);
        return ResponseEntity.ok(Map.of("message", "Record #" + id + " deleted successfully"));
    }

    @GetMapping("/records/{screenCode}/lookup")
    public ResponseEntity<List<Map<String, Object>>> getLookupOptions(@PathVariable String screenCode) {
        return ResponseEntity.ok(dynamicMasterService.getLookupOptions(screenCode));
    }

    @GetMapping("/records/{screenCode}/export")
    public ResponseEntity<?> exportExcel(@PathVariable String screenCode) {
        try {
            byte[] bytes = dynamicMasterService.exportExcel(screenCode);
            String filename = screenCode.toLowerCase() + "_data.xlsx";
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .contentType(MediaType.APPLICATION_OCTET_STREAM)
                    .body(bytes);
        } catch (Exception ex) {
            return ResponseEntity.badRequest().body("Failed to export Excel: " + ex.getMessage());
        }
    }
}
