package canteenManagment.main.UserEntity;

import java.util.Locale;

/**
 * Lifecycle shared by tasks and assignments. Values are stored as the enum name
 * so the Angular client can compare plain strings; rows written before the
 * status existed are read as {@link #TODO}.
 */
public enum WorkStatus {
    TODO, ASSIGNED, IN_PROGRESS, IN_REVIEW, DONE;

    /** Case/space tolerant parse used by the status endpoint. */
    public static WorkStatus parse(String value) {
        if (value == null || value.trim().isEmpty()) {
            throw new IllegalArgumentException("A status is required.");
        }
        String normalised = value.trim().toUpperCase(Locale.ROOT).replace(' ', '_').replace('-', '_');
        for (WorkStatus status : values()) {
            if (status.name().equals(normalised)) {
                return status;
            }
        }
        throw new IllegalArgumentException(
                "Unknown status \"" + value + "\". Use TODO, ASSIGNED, IN_PROGRESS, IN_REVIEW or DONE.");
    }

    public static WorkStatus orDefault(WorkStatus status) {
        return status == null ? TODO : status;
    }
}
