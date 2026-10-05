import { Module } from "@nestjs/common";

import { OrganizationsModule } from "../organizations/organizations.module.js";
import { ProductsModule } from "../products/products.module.js";
import { ProjectsController } from "./projects.controller.js";
import { ProjectsService } from "./projects.service.js";

@Module({
  imports: [OrganizationsModule, ProductsModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
