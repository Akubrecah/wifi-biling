import dotenv from 'dotenv';
import path from 'node:path';

// Automatically locate .env from workspace root or current dir
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: '/opt/wifi-billing/.env' });

import { PrismaClient, UserRole, PlanType } from '@prisma/client';
import { hash, Algorithm } from '@node-rs/argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Seed Super Admin
  const adminEmail = 'admin@wifibilling.local';
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await hash('Admin@Pass123!', {
      algorithm: Algorithm.Argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'System Superadmin',
        passwordHash,
        role: UserRole.SUPER_ADMIN,
        isActive: true,
      },
    });
    console.log('✅ Created Superadmin: admin@wifibilling.local');
  } else {
    console.log('ℹ️ Superadmin already exists.');
  }

  // 2. Seed Default Location
  const locationSlug = 'central-hotspot';
  let location = await prisma.location.findUnique({
    where: { slug: locationSlug },
  });

  if (!location) {
    location = await prisma.location.create({
      data: {
        name: 'Central Hotspot Hub',
        slug: locationSlug,
        description: 'Primary MikroTik hotspot location zone',
        address: 'Nairobi Central, Kenya',
        contactPhone: '+254700000000',
      },
    });
    console.log('✅ Created Location: Central Hotspot Hub');
  } else {
    console.log('ℹ️ Location already exists.');
  }

  // 3. Seed MikroTik-E7161B Router Gateway
  const nasIdentifier = 'MT-E7161B-01';
  const existingRouter = await prisma.router.findUnique({
    where: { nasIdentifier },
  });

  if (!existingRouter) {
    await prisma.router.create({
      data: {
        name: 'MikroTik-E7161B Gateway',
        nasIdentifier,
        locationId: location.id,
        ipAddress: '192.168.88.1',
        radiusSecret: 'testing123_production_radius_secret',
        apiPort: 8729,
        apiUsername: 'api_billing',
        apiPassword: 'secure_router_password',
        isActive: true,
      },
    });
    console.log('✅ Created Router: MikroTik-E7161B Gateway');
  } else {
    console.log('ℹ️ Router already exists.');
  }

  // 4. Seed FreeRADIUS NAS client table
  const existingNas = await prisma.nas.findFirst({
    where: { nasname: '192.168.88.1' },
  });

  if (!existingNas) {
    await prisma.nas.create({
      data: {
        nasname: '192.168.88.1',
        shortname: 'MT-E7161B-01',
        type: 'mikrotik',
        ports: 1812,
        secret: 'testing123_production_radius_secret',
        description: 'MikroTik-E7161B Gateway RADIUS client',
      },
    });
    console.log('✅ Seeded FreeRADIUS NAS client table');
  }

  // 5. Seed Ultra-Lucrative Bandwidth Plans (starting at 5 Bob)
  const plans = [
    {
      name: '45 Mins QuickBrowse',
      description: 'Super-affordable instant starter. Fast WhatsApp, X & M-Pesa.',
      price: 5,
      currency: 'KES',
      planType: PlanType.TIME_BASED,
      durationSec: 2700, // 45 mins
      dataLimitBytes: null,
      downloadSpeed: 3072, // 3 Mbps
      uploadSpeed: 1024,   // 1 Mbps
      burstDown: 4096,
      burstUp: 2048,
      burstThreshold: 2048,
      burstDuration: 8,
      maxDevices: 1,
    },
    {
      name: '2 Hours SuperSaver',
      description: 'Most popular for quick breaks. Smooth TikTok, Instagram & YouTube.',
      price: 10,
      currency: 'KES',
      planType: PlanType.TIME_BASED,
      durationSec: 7200, // 2 hours
      dataLimitBytes: null,
      downloadSpeed: 5120, // 5 Mbps
      uploadSpeed: 2048,   // 2 Mbps
      burstDown: 8192,
      burstUp: 3072,
      burstThreshold: 3072,
      burstDuration: 10,
      maxDevices: 1,
    },
    {
      name: '6 Hours Half-Day',
      description: 'Afternoon hustle pass. Uninterrupted Zoom, study & freelance work.',
      price: 20,
      currency: 'KES',
      planType: PlanType.TIME_BASED,
      durationSec: 21600, // 6 hours
      dataLimitBytes: null,
      downloadSpeed: 6144, // 6 Mbps
      uploadSpeed: 2560,   // 2.5 Mbps
      burstDown: 10240,
      burstUp: 4096,
      burstThreshold: 4096,
      burstDuration: 10,
      maxDevices: 1,
    },
    {
      name: '12 Hours Day Pass',
      description: 'Full day study & work. Heavy browsing, video streaming & downloads.',
      price: 30,
      currency: 'KES',
      planType: PlanType.TIME_BASED,
      durationSec: 43200, // 12 hours
      dataLimitBytes: null,
      downloadSpeed: 8192, // 8 Mbps
      uploadSpeed: 3072,   // 3 Mbps
      burstDown: 12288,
      burstUp: 4096,
      burstThreshold: 5120,
      burstDuration: 10,
      maxDevices: 1,
    },
    {
      name: '24 Hours Full Day',
      description: '24-hour round-the-clock power pass. Non-stop downloads & HD streaming.',
      price: 50,
      currency: 'KES',
      planType: PlanType.TIME_BASED,
      durationSec: 86400, // 24 hours
      dataLimitBytes: null,
      downloadSpeed: 10240, // 10 Mbps
      uploadSpeed: 4096,    // 4 Mbps
      burstDown: 15360,
      burstUp: 6144,
      burstThreshold: 6144,
      burstDuration: 15,
      maxDevices: 1,
    },
    {
      name: '3 Days Weekend Pass',
      description: 'Friday to Sunday unlimited movie binge, live football & entertainment.',
      price: 100,
      currency: 'KES',
      planType: PlanType.TIME_BASED,
      durationSec: 259200, // 72 hours / 3 days
      dataLimitBytes: null,
      downloadSpeed: 10240, // 10 Mbps
      uploadSpeed: 4096,
      burstDown: 15360,
      burstUp: 6144,
      maxDevices: 1,
    },
    {
      name: '7 Days Weekly Pass',
      description: 'Weekly VIP freedom. Connect 2 devices (Phone + Laptop) with zero speed throttling.',
      price: 200,
      currency: 'KES',
      planType: PlanType.TIME_BASED,
      durationSec: 604800, // 7 days
      dataLimitBytes: null,
      downloadSpeed: 12288, // 12 Mbps
      uploadSpeed: 5120,    // 5 Mbps
      burstDown: 18432,
      burstUp: 8192,
      maxDevices: 2,
    },
    {
      name: '14 Days Bi-Weekly Pro',
      description: 'Two weeks uninterrupted dual-device access. Smart choice for students & remote pros.',
      price: 350,
      currency: 'KES',
      planType: PlanType.TIME_BASED,
      durationSec: 1209600, // 14 days
      dataLimitBytes: null,
      downloadSpeed: 12288, // 12 Mbps
      uploadSpeed: 5120,
      burstDown: 18432,
      burstUp: 8192,
      maxDevices: 2,
    },
    {
      name: '30 Days Monthly Pass',
      description: 'The ultimate residential VIP pass. Connect up to 3 devices with blazing 15 Mbps speed 24/7.',
      price: 600,
      currency: 'KES',
      planType: PlanType.TIME_BASED,
      durationSec: 2592000, // 30 days
      dataLimitBytes: null,
      downloadSpeed: 15360, // 15 Mbps
      uploadSpeed: 6144,    // 6 Mbps
      burstDown: 20480,
      burstUp: 8192,
      maxDevices: 3,
    },
    {
      name: '5GB High-Speed Booster',
      description: '5GB pure high-speed data at 15 Mbps. Valid for 7 days.',
      price: 50,
      currency: 'KES',
      planType: PlanType.HYBRID,
      durationSec: 604800, // 7 days
      dataLimitBytes: BigInt(5368709120), // 5GB
      downloadSpeed: 15360, // 15 Mbps
      uploadSpeed: 6144,
      maxDevices: 1,
    },
    {
      name: '20GB Mega Download Pass',
      description: '20GB mega bandwidth for heavy downloaders, software updates & cloud backups. Valid 30 days.',
      price: 150,
      currency: 'KES',
      planType: PlanType.HYBRID,
      durationSec: 2592000, // 30 days
      dataLimitBytes: BigInt(21474836480), // 20GB
      downloadSpeed: 20480, // 20 Mbps
      uploadSpeed: 8192,
      maxDevices: 2,
    },
  ];

  for (const planData of plans) {
    const existingPlan = await prisma.plan.findFirst({
      where: { name: planData.name },
    });

    if (!existingPlan) {
      await prisma.plan.create({
        data: {
          ...planData,
          locationId: location.id,
          isActive: true,
        },
      });
      console.log(`✅ Seeded Plan: ${planData.name} (KES ${planData.price})`);
    } else {
      await prisma.plan.update({
        where: { id: existingPlan.id },
        data: {
          ...planData,
          locationId: location.id,
          isActive: true,
        },
      });
      console.log(`🔄 Updated Plan: ${planData.name} (KES ${planData.price})`);
    }
  }

  // Deactivate any legacy plans not in the lucrative lineup
  const activePlanNames = plans.map(p => p.name);
  const deactivated = await prisma.plan.updateMany({
    where: {
      name: { notIn: activePlanNames },
    },
    data: {
      isActive: false,
    },
  });
  if (deactivated.count > 0) {
    console.log(`ℹ️ Deactivated ${deactivated.count} legacy plans.`);
  }

  console.log('✨ Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
