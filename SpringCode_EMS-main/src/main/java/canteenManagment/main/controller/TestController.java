package canteenManagment.main.controller;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/test")
public class TestController {

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${spring.mail.username:unknown}")
    private String mailUser;

    @Value("${spring.mail.host:unknown}")
    private String mailHost;

    @Value("${spring.mail.port:0}")
    private int mailPort;

    @Value("${ems.mail.from:no-reply@ems.local}")
    private String mailFrom;

    @Value("${ems.mail.enabled:false}")
    private boolean mailEnabled;

    @GetMapping
    public String check() {
        return "Application is running!";
    }

    @GetMapping("/mail-diagnostics")
    public Map<String, Object> testMail(@RequestParam(required = false, defaultValue = "test@example.com") String to) {
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("mailEnabled", mailEnabled);
        res.put("smtpHost", mailHost);
        res.put("smtpPort", mailPort);
        res.put("smtpUsername", mailUser);
        res.put("fromAddress", mailFrom);
        res.put("targetRecipient", to);

        if (!mailEnabled) {
            res.put("status", "DISABLED");
            res.put("message", "ems.mail.enabled is set to false in application.properties");
            return res;
        }

        if (mailSender == null) {
            res.put("status", "FAILED");
            res.put("error", "No JavaMailSender configured on Spring context");
            return res;
        }

        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(mailFrom);
            msg.setTo(to);
            msg.setSubject("[EMS] Mail Service Diagnostics Test");
            msg.setText("This is a live diagnostic verification email from Employee Management System.\n\nSent successfully!");
            mailSender.send(msg);
            res.put("status", "SUCCESS");
            res.put("message", "Test email was accepted by SMTP server and dispatched to " + to);
        } catch (Exception e) {
            res.put("status", "AUTHENTICATION_OR_CONNECTION_ERROR");
            res.put("exception", e.getClass().getName());
            res.put("errorDetail", e.getMessage());
            if (e.getCause() != null) {
                res.put("rootCause", e.getCause().getMessage());
            }
        }
        return res;
    }
}