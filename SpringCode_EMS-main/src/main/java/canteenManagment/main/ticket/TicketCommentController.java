package canteenManagment.main.ticket;

import java.util.Date;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import canteenManagment.main.UserEntity.UserEntity;
import canteenManagment.main.security.AuthContext;
import canteenManagment.main.userReposerity.UserRepository;

@RestController
@RequestMapping("/api/tickets")
@CrossOrigin(origins = "http://localhost:4200", allowCredentials = "true")
public class TicketCommentController {

    private final TicketCommentRepository commentRepository;
    private final UserRepository userRepository;

    public TicketCommentController(TicketCommentRepository commentRepository, UserRepository userRepository) {
        this.commentRepository = commentRepository;
        this.userRepository = userRepository;
    }

    @GetMapping("/{code}/comments")
    public ResponseEntity<List<TicketComment>> getComments(@PathVariable String code) {
        if (code == null || code.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(commentRepository.findByTicketCodeOrderByCreatedAtAsc(code.trim().toUpperCase()));
    }

    @PostMapping("/{code}/comments")
    public ResponseEntity<?> addComment(
            @PathVariable String code,
            @RequestBody Map<String, Object> body,
            Authentication authentication) {
        if (code == null || code.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Ticket code is required.");
        }
        String content = body != null && body.get("content") != null ? body.get("content").toString().trim() : "";
        if (content.isEmpty()) {
            return ResponseEntity.badRequest().body("Comment content cannot be empty.");
        }

        String email = AuthContext.email(authentication);
        UserEntity user = email != null ? userRepository.findByEmailIgnoreCase(email).orElse(null) : null;
        String name = user != null && user.getName() != null ? user.getName() : (email != null ? email : "User");
        String role = user != null && user.getRole() != null ? user.getRole() : "MEMBER";

        Long ticketId = null;
        if (body.get("ticketId") != null) {
            try {
                ticketId = Long.valueOf(body.get("ticketId").toString());
            } catch (Exception ignored) {
            }
        }

        TicketComment comment = new TicketComment(code.trim().toUpperCase(), ticketId, email, name, role, content);
        if (body.get("resolutionReason") != null) {
            comment.setResolutionReason(body.get("resolutionReason").toString());
        }

        TicketComment saved = commentRepository.save(comment);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PostMapping("/{code}/resolution")
    public ResponseEntity<?> recordResolution(
            @PathVariable String code,
            @RequestBody Map<String, String> body,
            Authentication authentication) {
        if (code == null || code.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Ticket code is required.");
        }
        String reason = body != null ? body.get("resolutionReason") : "Fixed / Implemented";
        String note = body != null ? body.get("note") : "";

        String email = AuthContext.email(authentication);
        UserEntity user = email != null ? userRepository.findByEmailIgnoreCase(email).orElse(null) : null;
        String name = user != null && user.getName() != null ? user.getName() : (email != null ? email : "User");
        String role = user != null && user.getRole() != null ? user.getRole() : "MEMBER";

        String content = String.format("Resolved with status [%s]%s", reason, (note != null && !note.trim().isEmpty()) ? ": " + note.trim() : ".");

        TicketComment comment = new TicketComment(code.trim().toUpperCase(), null, email, name, role, content);
        comment.setResolutionReason(reason);
        TicketComment saved = commentRepository.save(comment);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/comments/{id}")
    public ResponseEntity<?> deleteComment(@PathVariable String id, Authentication authentication) {
        if (id == null) {
            return ResponseEntity.badRequest().build();
        }
        return commentRepository.findById(id).map(comment -> {
            boolean isAuthor = comment.getAuthorEmail() != null && comment.getAuthorEmail().equalsIgnoreCase(AuthContext.email(authentication));
            boolean isAdmin = AuthContext.isSuperAdmin(authentication);
            if (!isAuthor && !isAdmin) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Only the author or an admin can delete this comment.");
            }
            commentRepository.deleteById(id);
            return ResponseEntity.ok(Map.of("message", "Comment deleted."));
        }).orElse(ResponseEntity.notFound().build());
    }
}
