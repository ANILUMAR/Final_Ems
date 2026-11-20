package canteenManagment.main.UserEntity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;


import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
@Document(collection = "orders")
public class Order {

    @Id
    private Long orderId;

    private BigDecimal totalPrice;
    private String status; // PENDING, PREPARING, etc.
    private LocalDateTime orderDate;

    private List<OrderItem> items = new ArrayList<>(); // ✅ Prevents null issues

    // Getters and Setters

    public Long getOrderId() {
        return orderId;
    }

    public void setOrderId(Long orderId) {
        this.orderId = orderId;
    }

    public BigDecimal getTotalPrice() {
        return totalPrice;
    }

    public void setTotalPrice(BigDecimal totalPrice) {
        this.totalPrice = totalPrice;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getOrderDate() {
        return orderDate;
    }

    public void setOrderDate(LocalDateTime orderDate) {
        this.orderDate = orderDate;
    }

    public List<OrderItem> getItems() {
        return items;
    }

    public void setItems(List<OrderItem> items) {
        this.items = items;

        // ✅ Ensure bi-directional mapping is correct
        for (OrderItem item : items) {
            item.setOrder(this);
        }
    }

    // Optional helper method
    public void addItem(OrderItem item) {
        items.add(item);
        item.setOrder(this);
    }
}