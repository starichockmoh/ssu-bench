.PHONY: up up-db down down-clean

up:
	docker compose up --build -d

up-db:
	docker compose up -d postgres

down:
	docker compose down

down-clean:
	docker compose down -v
