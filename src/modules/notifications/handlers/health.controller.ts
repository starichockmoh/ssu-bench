import { Controller, Get } from '@nestjs/common';
import { NotificationsHealthService } from '../service/notifications-health.service';

@Controller()
export class HealthController {
  constructor(private readonly healthService: NotificationsHealthService) {}

  @Get('health')
  getHealth() {
    return this.healthService.getHealth();
  }
}
