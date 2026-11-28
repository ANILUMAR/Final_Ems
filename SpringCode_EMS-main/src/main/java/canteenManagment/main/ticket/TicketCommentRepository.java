package canteenManagment.main.ticket;

import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TicketCommentRepository extends MongoRepository<TicketComment, String> {
    List<TicketComment> findByTicketCodeOrderByCreatedAtAsc(String ticketCode);
    List<TicketComment> findByTicketIdOrderByCreatedAtAsc(Long ticketId);
}
