package canteenManagment.main.reference;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The client's whole vocabulary: roles, work statuses, priorities, timesheet
 * statuses and project statuses.
 *
 * <p>Reads are public (they are just the words on the buttons, and the login
 * screen needs them before there is a token). Writes are admin-only and are
 * the supported way to add or rename a value at runtime.</p>
 */
@RestController
@RequestMapping("/api/reference")
public class ReferenceController {

    private final ReferenceService referenceService;

    public ReferenceController(ReferenceService referenceService) {
        this.referenceService = referenceService;
    }

    /** One request loads every list, keyed by category. */
    @GetMapping
    public ResponseEntity<Map<String, List<LookupItem>>> all() {
        return ResponseEntity.ok(referenceService.all());
    }

    /** One list, for a screen that only needs part of the vocabulary. */
    @GetMapping("/{category}")
    public ResponseEntity<List<LookupItem>> byCategory(@PathVariable String category) {
        return ResponseEntity.ok(referenceService.active(category));
    }

    /** Creates the value or renames it - the same call covers both. */
    @PostMapping("/{category}")
    public ResponseEntity<?> save(@PathVariable String category, @RequestBody LookupItem item) {
        try {
            return ResponseEntity.ok(referenceService.save(category, item));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    /** Retires a value; rows already using it keep rendering. */
    @DeleteMapping("/{category}/{code}")
    public ResponseEntity<?> retire(@PathVariable String category, @PathVariable String code) {
        try {
            return ResponseEntity.ok(referenceService.setActive(category, code, false));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ex.getMessage());
        }
    }
}
