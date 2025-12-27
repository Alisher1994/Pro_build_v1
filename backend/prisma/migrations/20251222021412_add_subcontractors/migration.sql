-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "photo" TEXT,
    "genplan" TEXT,
    "render" TEXT,
    "client" TEXT,
    "manager" TEXT,
    "deputy" TEXT,
    "customer" TEXT,
    "contractor" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "floors" INTEGER NOT NULL DEFAULT 1,
    "undergroundFloors" INTEGER NOT NULL DEFAULT 0,
    "area" REAL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "constructionPhase" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Block_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Estimate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "totalCost" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "ifcFileUrl" TEXT,
    "xktFileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Estimate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Estimate_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EstimateSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "estimateId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ifcFileUrl" TEXT,
    "xktFileUrl" TEXT,
    "totalCost" REAL NOT NULL DEFAULT 0,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EstimateSection_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EstimateStage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT,
    "quantity" REAL,
    "unitCost" REAL,
    "totalCost" REAL NOT NULL DEFAULT 0,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EstimateStage_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "EstimateSection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stageId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT,
    "quantity" REAL,
    "unitCost" REAL,
    "totalCost" REAL NOT NULL DEFAULT 0,
    "ifcElements" TEXT,
    "ifcProperties" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkType_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "EstimateStage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "unit" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "totalCost" REAL NOT NULL,
    "resourceType" TEXT NOT NULL DEFAULT 'material',
    "ifcElements" TEXT,
    "ifcProperties" TEXT,
    "description" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Resource_workTypeId_fkey" FOREIGN KEY ("workTypeId") REFERENCES "WorkType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "blockId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Schedule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduleTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduleId" TEXT NOT NULL,
    "stageId" TEXT,
    "stageName" TEXT NOT NULL,
    "floor" TEXT,
    "zone" TEXT,
    "unit" TEXT,
    "quantity" REAL NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "duration" INTEGER,
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "actualQuantity" REAL NOT NULL DEFAULT 0,
    "progress" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "predecessorIds" TEXT,
    "ifcElements" TEXT,
    "notes" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScheduleTask_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Supply" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Supply_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupplyItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplyId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "requiredDate" TIMESTAMP(3) NOT NULL,
    "requiredQuantity" REAL NOT NULL,
    "orderedDate" TIMESTAMP(3),
    "orderedQuantity" REAL NOT NULL DEFAULT 0,
    "deliveredDate" TIMESTAMP(3),
    "deliveredQuantity" REAL NOT NULL DEFAULT 0,
    "supplier" TEXT,
    "purchasePrice" REAL,
    "status" TEXT NOT NULL DEFAULT 'not_ordered',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupplyItem_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "Supply" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SupplyItem_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Finance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Finance_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Subcontractor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "mfo" TEXT,
    "inn" TEXT,
    "bankName" TEXT,
    "account" TEXT,
    "address" TEXT,
    "companyPhoto" TEXT,
    "directorPhoto" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subcontractor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IFCElement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "elementId" TEXT NOT NULL,
    "sectionId" TEXT,
    "globalId" TEXT,
    "type" TEXT,
    "name" TEXT,
    "description" TEXT,
    "floor" INTEGER,
    "category" TEXT,
    "properties" TEXT,
    "geometry" TEXT,
    "status" TEXT NOT NULL DEFAULT 'not_planned',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "GanttTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "start_date" TIMESTAMP(3),
    "duration" INTEGER NOT NULL DEFAULT 1,
    "progress" REAL NOT NULL DEFAULT 0,
    "parent" TEXT,
    "type" TEXT NOT NULL DEFAULT 'task',
    "blockId" TEXT,
    "estimateSectionId" TEXT,
    "quantity" REAL,
    "unit" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GanttTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GanttLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT '0',
    "lag" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "GanttLink_source_fkey" FOREIGN KEY ("source") REFERENCES "GanttTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GanttLink_target_fkey" FOREIGN KEY ("target") REFERENCES "GanttTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkTypeGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "WorkTypeItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkTypeItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "WorkTypeGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Instruction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "InstructionWorkType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instructionId" TEXT NOT NULL,
    "workTypeItemId" TEXT NOT NULL,
    CONSTRAINT "InstructionWorkType_instructionId_fkey" FOREIGN KEY ("instructionId") REFERENCES "Instruction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InstructionWorkType_workTypeItemId_fkey" FOREIGN KEY ("workTypeItemId") REFERENCES "WorkTypeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Block_projectId_idx" ON "Block"("projectId");

-- CreateIndex
CREATE INDEX "Estimate_projectId_idx" ON "Estimate"("projectId");

-- CreateIndex
CREATE INDEX "Estimate_blockId_idx" ON "Estimate"("blockId");

-- CreateIndex
CREATE INDEX "EstimateSection_estimateId_idx" ON "EstimateSection"("estimateId");

-- CreateIndex
CREATE INDEX "EstimateStage_sectionId_idx" ON "EstimateStage"("sectionId");

-- CreateIndex
CREATE INDEX "WorkType_stageId_idx" ON "WorkType"("stageId");

-- CreateIndex
CREATE INDEX "Resource_workTypeId_idx" ON "Resource"("workTypeId");

-- CreateIndex
CREATE INDEX "Resource_resourceType_idx" ON "Resource"("resourceType");

-- CreateIndex
CREATE INDEX "Schedule_projectId_idx" ON "Schedule"("projectId");

-- CreateIndex
CREATE INDEX "Schedule_blockId_idx" ON "Schedule"("blockId");

-- CreateIndex
CREATE INDEX "ScheduleTask_scheduleId_idx" ON "ScheduleTask"("scheduleId");

-- CreateIndex
CREATE INDEX "ScheduleTask_stageId_idx" ON "ScheduleTask"("stageId");

-- CreateIndex
CREATE INDEX "ScheduleTask_floor_idx" ON "ScheduleTask"("floor");

-- CreateIndex
CREATE INDEX "ScheduleTask_status_idx" ON "ScheduleTask"("status");

-- CreateIndex
CREATE INDEX "Supply_projectId_idx" ON "Supply"("projectId");

-- CreateIndex
CREATE INDEX "SupplyItem_supplyId_idx" ON "SupplyItem"("supplyId");

-- CreateIndex
CREATE INDEX "SupplyItem_resourceId_idx" ON "SupplyItem"("resourceId");

-- CreateIndex
CREATE INDEX "SupplyItem_status_idx" ON "SupplyItem"("status");

-- CreateIndex
CREATE INDEX "Finance_projectId_idx" ON "Finance"("projectId");

-- CreateIndex
CREATE INDEX "Finance_type_idx" ON "Finance"("type");

-- CreateIndex
CREATE INDEX "Finance_date_idx" ON "Finance"("date");

-- CreateIndex
CREATE INDEX "Subcontractor_projectId_idx" ON "Subcontractor"("projectId");

-- CreateIndex
CREATE INDEX "Subcontractor_status_idx" ON "Subcontractor"("status");

-- CreateIndex
CREATE INDEX "IFCElement_sectionId_idx" ON "IFCElement"("sectionId");

-- CreateIndex
CREATE INDEX "IFCElement_type_idx" ON "IFCElement"("type");

-- CreateIndex
CREATE INDEX "IFCElement_status_idx" ON "IFCElement"("status");

-- CreateIndex
CREATE UNIQUE INDEX "IFCElement_elementId_sectionId_key" ON "IFCElement"("elementId", "sectionId");

-- CreateIndex
CREATE INDEX "GanttTask_projectId_idx" ON "GanttTask"("projectId");

-- CreateIndex
CREATE INDEX "GanttTask_parent_idx" ON "GanttTask"("parent");

-- CreateIndex
CREATE INDEX "GanttLink_source_idx" ON "GanttLink"("source");

-- CreateIndex
CREATE INDEX "GanttLink_target_idx" ON "GanttLink"("target");

-- CreateIndex
CREATE INDEX "WorkTypeItem_groupId_idx" ON "WorkTypeItem"("groupId");

-- CreateIndex
CREATE INDEX "InstructionWorkType_instructionId_idx" ON "InstructionWorkType"("instructionId");

-- CreateIndex
CREATE INDEX "InstructionWorkType_workTypeItemId_idx" ON "InstructionWorkType"("workTypeItemId");

-- CreateIndex
CREATE UNIQUE INDEX "InstructionWorkType_instructionId_workTypeItemId_key" ON "InstructionWorkType"("instructionId", "workTypeItemId");
