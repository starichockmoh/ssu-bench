.PHONY: up up-db up-infra down down-clean

up:
	docker compose up --build -d

up-db:
	docker compose up -d postgres

up-infra:
	docker compose up -d postgres kafka

down:
	docker compose down

down-clean:
	docker compose down -v
