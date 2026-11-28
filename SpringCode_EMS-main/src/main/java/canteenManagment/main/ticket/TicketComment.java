package canteenManagment.main.ticket;

import java.util.Date;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "ticket_comments")
public class TicketComment {

    @Id
    private String id;
    private String ticketCode;
    private Long ticketId;
    private String authorEmail;
    private String authorName;
    private String authorRole;
    private String content;
    private String resolutionReason;
    private Date createdAt;

    public TicketComment() {
        this.createdAt = new Date();
    }

    public TicketComment(String ticketCode, Long ticketId, String authorEmail, String authorName, String authorRole, String content) {
        this.ticketCode = ticketCode;
        this.ticketId = ticketId;
        this.authorEmail = authorEmail;
        this.authorName = authorName;
        this.authorRole = authorRole;
        this.content = content;
        this.createdAt = new Date();
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTicketCode() {
        return ticketCode;
    }

    public void setTicketCode(String ticketCode) {
        this.ticketCode = ticketCode;
    }

    public Long getTicketId() {
        return ticketId;
    }

    public void setTicketId(Long ticketId) {
        this.ticketId = ticketId;
    }

    public String getAuthorEmail() {
        return authorEmail;
    }

    public void setAuthorEmail(String authorEmail) {
        this.authorEmail = authorEmail;
    }

    public String getAuthorName() {
        return authorName;
    }

    public void setAuthorName(String authorName) {
        this.authorName = authorName;
    }

    public String getAuthorRole() {
        return authorRole;
    }

    public void setAuthorRole(String authorRole) {
        this.authorRole = authorRole;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getResolutionReason() {
        return resolutionReason;
    }

    public void setResolutionReason(String resolutionReason) {
        this.resolutionReason = resolutionReason;
    }

    public Date getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
    }
}
