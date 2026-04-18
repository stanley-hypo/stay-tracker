import { pgTable, uuid, varchar, date, timestamp } from "drizzle-orm/pg-core";

export const trips = pgTable("trips", {
  id: uuid("id").primaryKey().defaultRandom(),
  destination: varchar("destination", { length: 255 }).notNull(),
  departDate: date("depart_date").notNull(),
  returnDate: date("return_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Trip = typeof trips.$inferSelect;
export type NewTrip = typeof trips.$inferInsert;
