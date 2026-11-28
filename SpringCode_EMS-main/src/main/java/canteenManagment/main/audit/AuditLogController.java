package canteenManagment.main.audit;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST controller for centralized Application Audit Logs and Activity Tracking.
 */
@RestController
@RequestMapping("/api/audit-logs")
@CrossOrigin(origins = "http://localhost:4200", allowCredentials = "true")
public class AuditLogController {

    private final AuditLogService auditLogService;

    public AuditLogController(AuditLogService auditLogService) {
        this.auditLogService = auditLogService;
    }

    /**
     * Returns the full history of transactions and activities performed across the application.
     */
    @GetMapping
    public ResponseEntity<List<AuditLogItemDTO>> getAuditLogs(
            @RequestParam(required = false, defaultValue = "ALL") String category,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate) {
        List<AuditLogItemDTO> logs = auditLogService.getAuditLogs(category, search, fromDate, toDate);
        return ResponseEntity.ok(logs);
    }

    /**
     * Returns high-level statistics for the audit dashboard cards.
     */
    @GetMapping("/stats")
    public ResponseEntity<AuditStatsDTO> getStats() {
        return ResponseEntity.ok(auditLogService.getStats());
    }
}
