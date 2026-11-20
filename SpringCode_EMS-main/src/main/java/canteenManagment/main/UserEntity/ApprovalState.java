package canteenManagment.main.UserEntity;

import java.util.Locale;

/**
 * Where a work item stands with the testing team, before it becomes somebody's
 * assignment.
 *
 * <p>Testers report work; the testing team leader decides whether it goes on to
 * development. So the approval state is separate from {@link WorkStatus}: it
 * answers "may this be handed to a developer at all", while the status answers
 * "how far has the developer got". An item keeps its identity through both.</p>
 *
 * <pre>
 * PENDING      the tester submitted it; waiting for the testing team leader
 * APPROVED     cleared for development; the developer team leader assigns it
 * REJECTED     sent back to the tester with a comment, to be corrected
 * NOT_REQUIRED work the CEO or a team leader created and handed out directly
 * </pre>
 *
 * <p>Rows written before this workflow existed carry no value and read as
 * {@link #NOT_REQUIRED}, which is what they are: already in somebody's queue.</p>
 */
public enum ApprovalState {
    NOT_REQUIRED, PENDING, APPROVED, REJECTED;

    /** Case/space tolerant parse used by the review endpoint. */
    public static ApprovalState parse(String value) {
        if (value == null || value.trim().isEmpty()) {
            throw new IllegalArgumentException("A decision is required.");
        }
        String normalised = value.trim().toUpperCase(Locale.ROOT).replace(' ', '_').replace('-', '_');
        for (ApprovalState state : values()) {
            if (state.name().equals(normalised)) {
                return state;
            }
        }
        throw new IllegalArgumentException(
                "Unknown approval state \"" + value + "\". Use NOT_REQUIRED, PENDING, APPROVED or REJECTED.");
    }

    /** Legacy rows were handed out directly, so they need no review. */
    public static ApprovalState orDefault(ApprovalState state) {
        return state == null ? NOT_REQUIRED : state;
    }

    /** Still inside the testing team: hidden from the register and the boards. */
    public boolean isInIntake() {
        return this == PENDING || this == REJECTED;
    }
}
