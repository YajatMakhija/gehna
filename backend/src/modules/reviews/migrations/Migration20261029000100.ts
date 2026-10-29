import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261029000100 extends Migration {
  async up(): Promise<void> {
    this.addSql(`create table if not exists "gehna_review" (
      "id" text not null, "product_id" text not null, "customer_id" text not null,
      "reviewer_name" text not null, "rating" integer not null check ("rating" between 1 and 5),
      "body" text not null, "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null,
      constraint "gehna_review_pkey" primary key ("id")
    );`);
    this.addSql('create unique index if not exists "IDX_gehna_review_product_customer" on "gehna_review" ("product_id", "customer_id") where "deleted_at" is null;');
    this.addSql('create index if not exists "IDX_gehna_review_product" on "gehna_review" ("product_id", "created_at") where "deleted_at" is null;');
  }
  async down(): Promise<void> {
    this.addSql('drop table if exists "gehna_review" cascade;');
  }
}
