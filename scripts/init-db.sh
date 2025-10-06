#!/bin/bash

echo "Initializing database..."

# Generate Prisma client
npx prisma generate

# Push the schema to the database (creates the database file and tables)
npx prisma db push

echo "Database initialized successfully!"
echo "You can view your database with: npx prisma studio"