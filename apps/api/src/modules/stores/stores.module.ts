/**
 * Stores Module
 */

import { Module } from '@nestjs/common';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';
import { StoresRepository } from './stores.repository';
import { DomainsController } from './domains.controller';
import { DomainsService } from './domains.service';
import { NavigationController } from './navigation.controller';
import { NavigationService } from './navigation.service';

@Module({
  controllers: [StoresController, DomainsController, NavigationController],
  providers: [
    StoresService,
    StoresRepository,
    DomainsService,
    NavigationService,
  ],
  exports: [StoresService, StoresRepository],
})
export class StoresModule {}
