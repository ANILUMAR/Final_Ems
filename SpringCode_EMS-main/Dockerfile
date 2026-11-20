
# Stage 1: Build Spring Boot application
FROM maven:3.8.8-eclipse-temurin-11 AS build

WORKDIR /app

COPY . .

RUN mvn clean package -DskipTests

# Stage 2: Run application
FROM eclipse-temurin:11-jre

WORKDIR /app

COPY --from=build /app/target/*.jar app.jar

EXPOSE 9001

ENTRYPOINT ["sh", "-c", "java -Dserver.port=${PORT:-9001} -jar app.jar"]
