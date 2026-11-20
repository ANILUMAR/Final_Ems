package canteenManagment.main.security;

import java.util.List;

import org.springframework.cache.CacheManager;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableWebSecurity
public class SecurityConfig {


	@Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authenticationConfiguration) throws Exception {
        return authenticationConfiguration.getAuthenticationManager();
    }

     private final JwtFilter jwtFilter;

     private final    AuthenticationEntryPoint unauthorizedHandler;

    public SecurityConfig(JwtFilter jwtFilter, AuthenticationEntryPoint unauthorizedHandler) {
        this.jwtFilter = jwtFilter;
        this.unauthorizedHandler = unauthorizedHandler;
    }
    
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        AuthenticationEntryPoint customEntryPoint = null;
        http
        .csrf().disable()
        .cors() // 👈 Enable CORS
        .and()
            .authorizeRequests(auth -> auth
                // Public
                .antMatchers("/api/auth/register", "/api/auth/login", "/api/translation", "/attachments/**").permitAll()
                // The labels, statuses and priorities every screen renders.
                // Read-only and harmless, and needed on the login screen before
                // a token exists; changing them stays an admin action.
                .antMatchers(HttpMethod.GET, "/api/reference/**").permitAll()
                .antMatchers(HttpMethod.POST, "/api/reference/**").hasRole("ADMIN")
                .antMatchers(HttpMethod.DELETE, "/api/reference/**").hasRole("ADMIN")
                // The module / sub module / screen master data. Any signed-in
                // account may read the lists (the task forms need them); writing
                // is administrative work, so only the CEO may do it - neither
                // team curates the vocabulary. MasterDataController re-checks.
                .antMatchers(HttpMethod.POST, "/api/masters", "/api/masters/**")
                        .hasAnyRole("ADMIN", "SUPER_ADMIN")
                .antMatchers(HttpMethod.DELETE, "/api/masters", "/api/masters/**")
                        .hasAnyRole("ADMIN", "SUPER_ADMIN")
                // Account administration stays with the CEO. A team leader runs
                // work, not people's logins, so no lead may reach these either.
                .antMatchers("/api/auth/registredEmployees", "/api/auth/delete", "/api/auth/bulk-register",
                        "/api/auth/roles", "/api/auth/users/**").hasRole("ADMIN")
                // Only the CEO creates work items and projects
                .antMatchers(HttpMethod.POST, "/api/tasks").hasRole("ADMIN")
                // Projects are created by the "Create Project" admin screen only
                .antMatchers(HttpMethod.POST, "/api/projects").hasRole("ADMIN")
                // Creating an assignment belongs to the people who run the work:
                // the CEO and both team leaders by role, a tester once an admin
                // grants task access. The controller re-checks the provision, so
                // this only says which roles are allowed to ask.
                .antMatchers(HttpMethod.POST, "/api/assigntasks/create")
                        .hasAnyRole("ADMIN", "SUPER_ADMIN", "TESTER", "TESTER_LEAD", "DEVELOPER_LEAD")
                // The approval chain between the testing team and the
                // developers. Testers raise; their own team leader decides;
                // the developer team leader hands the approved items out. A
                // step is only reachable by the role that performs it - the
                // controllers re-check, because approval is what decides
                // whether work reaches the development team at all. Raising and
                // its submission list are the testing team's alone: the CEO
                // decides the intake and hands it out, it files nothing.
                .antMatchers(HttpMethod.POST, "/api/workflow/submissions")
                        .hasAnyRole("TESTER", "TESTER_LEAD")
                .antMatchers(HttpMethod.GET, "/api/workflow/my-submissions")
                        .hasAnyRole("TESTER", "TESTER_LEAD")
                .antMatchers(HttpMethod.PUT, "/api/workflow/submissions/*")
                        .hasAnyRole("TESTER", "TESTER_LEAD")
                .antMatchers(HttpMethod.GET, "/api/workflow/approvals")
                        .hasAnyRole("ADMIN", "SUPER_ADMIN", "TESTER_LEAD")
                .antMatchers(HttpMethod.PATCH, "/api/workflow/submissions/*/review")
                        .hasAnyRole("ADMIN", "SUPER_ADMIN", "TESTER_LEAD")
                .antMatchers(HttpMethod.PATCH, "/api/workflow/submissions/*/revert-approval")
                        .hasAnyRole("ADMIN", "SUPER_ADMIN", "TESTER_LEAD")
                .antMatchers(HttpMethod.GET, "/api/workflow/dev-queue")
                        .hasAnyRole("ADMIN", "SUPER_ADMIN", "DEVELOPER_LEAD")
                .antMatchers(HttpMethod.PATCH, "/api/workflow/submissions/*/assign")
                        .hasAnyRole("ADMIN", "SUPER_ADMIN", "DEVELOPER_LEAD")
                .antMatchers(HttpMethod.PATCH, "/api/workflow/submissions/*/lead-notes")
                        .hasAnyRole("ADMIN", "SUPER_ADMIN", "DEVELOPER_LEAD")
                .antMatchers(HttpMethod.GET, "/api/workflow/completed-tasks")
                        .hasAnyRole("ADMIN", "SUPER_ADMIN", "DEVELOPER_LEAD", "EMPLOYEE")
                .antMatchers(HttpMethod.PATCH, "/api/workflow/tasks/*/release-for-testing")
                        .hasAnyRole("ADMIN", "SUPER_ADMIN", "DEVELOPER_LEAD")
                .antMatchers(HttpMethod.PATCH, "/api/workflow/tasks/*/lead-review")
                        .hasAnyRole("ADMIN", "SUPER_ADMIN", "DEVELOPER_LEAD")
                .antMatchers(HttpMethod.POST, "/api/workflow/tasks/batch-release-for-testing")
                        .hasAnyRole("ADMIN", "SUPER_ADMIN", "DEVELOPER_LEAD")
                .antMatchers(HttpMethod.GET, "/api/workflow/on-hold-tasks")
                        .hasAnyRole("ADMIN", "SUPER_ADMIN", "DEVELOPER_LEAD", "EMPLOYEE")
                .antMatchers(HttpMethod.PATCH, "/api/workflow/tasks/*/unhold")
                        .hasAnyRole("ADMIN", "SUPER_ADMIN", "DEVELOPER_LEAD")
                .antMatchers(HttpMethod.GET, "/api/workflow/testing-queue")
                        .hasAnyRole("ADMIN", "SUPER_ADMIN", "TESTER_LEAD")
                .antMatchers(HttpMethod.PATCH, "/api/workflow/tasks/*/assign-tester")
                        .hasAnyRole("ADMIN", "SUPER_ADMIN", "TESTER_LEAD")
                .antMatchers(HttpMethod.PATCH, "/api/workflow/tasks/*/verify-test")
                        .hasAnyRole("ADMIN", "SUPER_ADMIN", "TESTER_LEAD", "TESTER")
                .antMatchers(HttpMethod.GET, "/api/workflow/tested-completed")
                        .hasAnyRole("ADMIN", "SUPER_ADMIN", "TESTER_LEAD", "DEVELOPER_LEAD")
                .antMatchers(HttpMethod.GET, "/api/workflow/tester-completed")
                        .hasAnyRole("ADMIN", "SUPER_ADMIN", "TESTER_LEAD", "TESTER")
                // The create and edit dialogs read their pickers from here, so a
                // granted tester needs the same read access as a leader.
                .antMatchers(
                        "/api/assigntasks/getname",
                        "/api/assigntasks/getAllProjects",
                        "/api/assigntasks/getModuleDescription",
                        "/api/assigntasks/getprocessDescription",
                        "/api/assigntasks/getcreateDesc",
                        "/api/assigntasks/totalProjects"
                ).hasAnyRole("ADMIN", "SUPER_ADMIN", "TESTER", "TESTER_LEAD", "DEVELOPER_LEAD")
                // Everything else: any signed-in role, data scoped inside the controllers
                .anyRequest().authenticated()
            )
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(customEntryPoint)  // Return 401
            )
            .sessionManagement(sess -> sess
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS) // No server session
            );

       
		http.addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
    
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    } 
    
    @Bean
    public CacheManager cacheManager() {
        // "lookups" backs ReferenceService, so a rename clears it immediately.
        return new ConcurrentMapCacheManager("usersByEmail", "lookups");
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of("http://localhost:4200"));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    
}