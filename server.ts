import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Initialize Google GenAI Client
const geminiApiKey = process.env.GEMINI_API_KEY || '';
let genAI: GoogleGenAI | null = null;
if (geminiApiKey && geminiApiKey !== 'MY_GEMINI_API_KEY' && geminiApiKey !== 'YOUR_GEMINI_API_KEY') {
  try {
    genAI = new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (err) {
    console.warn('Failed to initialize GoogleGenAI client:', err);
  }
}

// -------------------------------------------------------------
// DATABASE STATE (Mirrors Django ORM MySQL Database Models)
// -------------------------------------------------------------

interface Facility {
  id: number;
  name: string;
  facility_code: string;
  address: string;
  city: string;
  state: string;
  facility_type: string;
  floor_area_sqm: number;
  connected_load_kw: number;
  solar_capacity_kw: number;
  operational_status: 'operational' | 'maintenance' | 'inactive';
  manager_name: string;
  manager_email: string;
  created_at: string;
}

interface Meter {
  id: number;
  meter_code: string;
  name: string;
  facility_id: number;
  meter_type: string;
  energy_source: 'grid' | 'solar' | 'diesel' | 'battery';
  installation_date: string;
  status: 'active' | 'maintenance' | 'offline';
  location: string;
  rated_voltage_v: number;
  rated_capacity_kw: number;
  latest_reading?: MeterReading;
}

interface MeterReading {
  id: number;
  meter_id: number;
  timestamp: string;
  voltage_v: number;
  current_a: number;
  power_kw: number;
  energy_kwh: number;
  power_factor: number;
  frequency_hz: number;
  is_simulated: boolean;
}

interface UtilityBill {
  id: number;
  bill_number: string;
  facility_id: number;
  billing_month: string;
  billing_period_start: string;
  billing_period_end: string;
  units_consumed_kwh: number;
  peak_demand_recorded_kw: number;
  sanctioned_load_kw: number;
  energy_rate_applied: number;
  energy_charges_inr: number;
  fixed_demand_charges_inr: number;
  fuel_surcharge_inr: number;
  solar_rebate_inr: number;
  taxes_inr: number;
  total_amount_inr: number;
  due_date: string;
  payment_status: 'paid' | 'pending' | 'overdue';
  paid_date?: string;
}

interface EnergyAlert {
  id: number;
  facility_id: number;
  meter_id?: number;
  alert_title: string;
  alert_type: string;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  recommendation: string;
  timestamp: string;
  is_resolved: boolean;
  resolved_at?: string;
  resolved_by?: string;
}

interface RenewableSystem {
  id: number;
  facility_id: number;
  system_name: string;
  technology_type: string;
  solar_capacity_kw: number;
  inverter_capacity_kw: number;
  battery_capacity_kwh: number;
  battery_soc_pct: number;
  generation_today_kwh: number;
  exported_today_kwh: number;
  self_consumed_today_kwh: number;
  solar_irradiance_wm2: number;
}

// Seed Facilities
let facilities: Facility[] = [
  {
    id: 1,
    name: 'Corporate Tech Park HQ',
    facility_code: 'FAC-BLR-01',
    address: 'Plot 42, Electronic City Phase 1',
    city: 'Bengaluru',
    state: 'Karnataka',
    facility_type: 'commercial_office',
    floor_area_sqm: 28500,
    connected_load_kw: 650,
    solar_capacity_kw: 150,
    operational_status: 'operational',
    manager_name: 'Priya Nair',
    manager_email: 'priya.nair@greengrid.io',
    created_at: '2025-01-15T09:00:00Z',
  },
  {
    id: 2,
    name: 'Solar Manufacturing Plant 4',
    facility_code: 'FAC-PUN-02',
    address: 'MIDC Chakan Industrial Corridor',
    city: 'Pune',
    state: 'Maharashtra',
    facility_type: 'manufacturing_plant',
    floor_area_sqm: 45000,
    connected_load_kw: 1200,
    solar_capacity_kw: 200,
    operational_status: 'operational',
    manager_name: 'Rajesh Kulkarni',
    manager_email: 'rajesh.k@greengrid.io',
    created_at: '2025-02-10T10:00:00Z',
  },
  {
    id: 3,
    name: 'Greenfield Logistics Hub',
    facility_code: 'FAC-NCR-03',
    address: 'NH-48 Logistics Parkway, Bilaspur',
    city: 'Gurugram',
    state: 'Haryana',
    facility_type: 'logistics_warehouse',
    floor_area_sqm: 36000,
    connected_load_kw: 350,
    solar_capacity_kw: 70,
    operational_status: 'operational',
    manager_name: 'Amitabh Roy',
    manager_email: 'amitabh.roy@greengrid.io',
    created_at: '2025-03-01T08:30:00Z',
  },
  {
    id: 4,
    name: 'National Academic Engineering Campus',
    facility_code: 'FAC-CHN-04',
    address: 'OMR IT Highway, Navalur',
    city: 'Chennai',
    state: 'Tamil Nadu',
    facility_type: 'education_campus',
    floor_area_sqm: 52000,
    connected_load_kw: 850,
    solar_capacity_kw: 120,
    operational_status: 'operational',
    manager_name: 'Dr. K. Swaminathan',
    manager_email: 'swaminathan@greengrid.io',
    created_at: '2025-01-20T11:00:00Z',
  },
  {
    id: 5,
    name: 'Metro Cold Chain Terminal',
    facility_code: 'FAC-HYD-05',
    address: 'Shamshabad Agro Cargo Terminal',
    city: 'Hyderabad',
    state: 'Telangana',
    facility_type: 'cold_storage',
    floor_area_sqm: 18000,
    connected_load_kw: 400,
    solar_capacity_kw: 0,
    operational_status: 'operational',
    manager_name: 'Venkat Reddy',
    manager_email: 'venkat.reddy@greengrid.io',
    created_at: '2025-04-05T09:15:00Z',
  },
];

// Seed Meters
let meters: Meter[] = [
  { id: 1, meter_code: 'MTR-BLR-01', name: 'Main Incomer 11kV Grid', facility_id: 1, meter_type: 'grid_main', energy_source: 'grid', installation_date: '2025-01-20', status: 'active', location: 'Substation Bay 1', rated_voltage_v: 415, rated_capacity_kw: 650 },
  { id: 2, meter_code: 'MTR-BLR-02', name: 'Rooftop Solar PV Inverter', facility_id: 1, meter_type: 'solar_inverter', energy_source: 'solar', installation_date: '2025-01-22', status: 'active', location: 'Roof Terrace Array', rated_voltage_v: 415, rated_capacity_kw: 150 },
  { id: 3, meter_code: 'MTR-BLR-03', name: 'HVAC Water-Cooled Chiller', facility_id: 1, meter_type: 'hvac_chiller', energy_source: 'grid', installation_date: '2025-01-25', status: 'active', location: 'Basement Plant Room', rated_voltage_v: 415, rated_capacity_kw: 220 },
  { id: 4, meter_code: 'MTR-BLR-04', name: 'Tier-3 Datacenter UPS', facility_id: 1, meter_type: 'ups_datacenter', energy_source: 'grid', installation_date: '2025-01-28', status: 'active', location: 'Server Hall 2nd Floor', rated_voltage_v: 415, rated_capacity_kw: 140 },
  { id: 5, meter_code: 'MTR-PUN-01', name: 'Main 33kV Substation Bay', facility_id: 2, meter_type: 'grid_main', energy_source: 'grid', installation_date: '2025-02-12', status: 'active', location: 'Chakan Switchyard', rated_voltage_v: 415, rated_capacity_kw: 1200 },
  { id: 6, meter_code: 'MTR-PUN-02', name: 'Solar Carport Plant', facility_id: 2, meter_type: 'solar_inverter', energy_source: 'solar', installation_date: '2025-02-15', status: 'active', location: 'Carport Canopy Section B', rated_voltage_v: 415, rated_capacity_kw: 200 },
  { id: 7, meter_code: 'MTR-PUN-03', name: 'Heavy Press Machine Line A', facility_id: 2, meter_type: 'production_line', energy_source: 'grid', installation_date: '2025-02-18', status: 'active', location: 'Fabrication Shop Floor', rated_voltage_v: 415, rated_capacity_kw: 450 },
  { id: 8, meter_code: 'MTR-PUN-04', name: 'Welding & Robotic Cell', facility_id: 2, meter_type: 'production_line', energy_source: 'grid', installation_date: '2025-02-20', status: 'active', location: 'Robotics Bay 3', rated_voltage_v: 415, rated_capacity_kw: 300 },
  { id: 9, meter_code: 'MTR-NCR-01', name: 'Main Distribution Board', facility_id: 3, meter_type: 'grid_main', energy_source: 'grid', installation_date: '2025-03-05', status: 'active', location: 'Inbound Dock Electric Room', rated_voltage_v: 415, rated_capacity_kw: 350 },
  { id: 10, meter_code: 'MTR-NCR-02', name: 'Automated Conveyor & Dock', facility_id: 3, meter_type: 'production_line', energy_source: 'grid', installation_date: '2025-03-08', status: 'active', location: 'Sortation Mezzanine', rated_voltage_v: 415, rated_capacity_kw: 180 },
  { id: 11, meter_code: 'MTR-CHN-01', name: 'Main Campus Substation', facility_id: 4, meter_type: 'grid_main', energy_source: 'grid', installation_date: '2025-01-25', status: 'active', location: 'Academic Block Substation', rated_voltage_v: 415, rated_capacity_kw: 850 },
  { id: 12, meter_code: 'MTR-HYD-01', name: 'Central Ammonia Refrigeration', facility_id: 5, meter_type: 'hvac_chiller', energy_source: 'grid', installation_date: '2025-04-10', status: 'active', location: 'Compressor Hall Bay 1', rated_voltage_v: 415, rated_capacity_kw: 350 },
];

// Seed Readings
let readings: MeterReading[] = [];
let readingIdCounter = 1;

function generateMeterReading(meter: Meter, targetDate: Date): MeterReading {
  const hour = targetDate.getHours() + targetDate.getMinutes() / 60;
  const voltage = Math.round((415 + (Math.random() * 12 - 6)) * 10) / 10;
  const frequency = Math.round((50.0 + (Math.random() * 0.2 - 0.1)) * 100) / 100;
  let power_kw = 0;
  let pf = Math.round((0.92 + Math.random() * 0.06) * 1000) / 1000;

  if (meter.energy_source === 'solar') {
    if (hour >= 6.0 && hour <= 18.5) {
      const bell = Math.exp(-0.5 * Math.pow((hour - 12.5) / 2.5, 2));
      power_kw = Math.round(meter.rated_capacity_kw * bell * (0.85 + Math.random() * 0.15) * 10) / 10;
    } else {
      power_kw = 0;
    }
    pf = 0.99;
  } else if (meter.meter_type === 'hvac_chiller') {
    const factor = hour >= 9 && hour <= 19 ? 0.78 : 0.28;
    power_kw = Math.round(meter.rated_capacity_kw * factor * (0.9 + Math.random() * 0.15) * 10) / 10;
    pf = Math.round((0.87 + Math.random() * 0.05) * 1000) / 1000;
  } else if (meter.meter_type === 'ups_datacenter') {
    power_kw = Math.round(meter.rated_capacity_kw * (0.7 + Math.random() * 0.08) * 10) / 10;
    pf = 0.98;
  } else {
    const isShift = hour >= 8.5 && hour <= 18.5;
    const factor = isShift ? 0.75 + Math.random() * 0.18 : 0.25 + Math.random() * 0.12;
    power_kw = Math.round(meter.rated_capacity_kw * factor * 10) / 10;
  }

  const denom = Math.sqrt(3) * (voltage / 1000) * pf;
  const current_a = Math.round((power_kw / (denom || 1)) * 10) / 10;
  const energy_kwh = Math.round(power_kw * 1.0 * 10) / 10; // 1-hour interval

  return {
    id: readingIdCounter++,
    meter_id: meter.id,
    timestamp: targetDate.toISOString(),
    voltage_v: voltage,
    current_a,
    power_kw,
    energy_kwh,
    power_factor: pf,
    frequency_hz: frequency,
    is_simulated: true,
  };
}

// Pre-populate 30 days of daily readings for each meter
const now = new Date();
for (let d = 30; d >= 0; d--) {
  const date = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
  date.setHours(14, 0, 0, 0); // afternoon peak snapshot
  for (const meter of meters) {
    const r = generateMeterReading(meter, date);
    readings.push(r);
    meter.latest_reading = r;
  }
}

// Seed Renewable Systems
let renewableSystems: RenewableSystem[] = [
  {
    id: 1,
    facility_id: 1,
    system_name: 'Tech Park Solar Array A',
    technology_type: 'Rooftop Solar PV',
    solar_capacity_kw: 150,
    inverter_capacity_kw: 140,
    battery_capacity_kwh: 200,
    battery_soc_pct: 82.5,
    generation_today_kwh: 640.2,
    exported_today_kwh: 85.0,
    self_consumed_today_kwh: 555.2,
    solar_irradiance_wm2: 840,
  },
  {
    id: 2,
    facility_id: 2,
    system_name: 'Chakan Plant Solar Canopy',
    technology_type: 'Ground & Carport Solar',
    solar_capacity_kw: 200,
    inverter_capacity_kw: 190,
    battery_capacity_kwh: 300,
    battery_soc_pct: 74.0,
    generation_today_kwh: 890.5,
    exported_today_kwh: 120.0,
    self_consumed_today_kwh: 770.5,
    solar_irradiance_wm2: 875,
  },
  {
    id: 3,
    facility_id: 3,
    system_name: 'Bilaspur Logistics Solar Roof',
    technology_type: 'Rooftop Solar PV',
    solar_capacity_kw: 70,
    inverter_capacity_kw: 65,
    battery_capacity_kwh: 100,
    battery_soc_pct: 91.0,
    generation_today_kwh: 310.0,
    exported_today_kwh: 45.0,
    self_consumed_today_kwh: 265.0,
    solar_irradiance_wm2: 810,
  },
  {
    id: 4,
    facility_id: 4,
    system_name: 'OMR Campus Science Solar',
    technology_type: 'Rooftop Solar PV',
    solar_capacity_kw: 120,
    inverter_capacity_kw: 110,
    battery_capacity_kwh: 150,
    battery_soc_pct: 68.0,
    generation_today_kwh: 512.0,
    exported_today_kwh: 60.0,
    self_consumed_today_kwh: 452.0,
    solar_irradiance_wm2: 830,
  },
];

// Seed Utility Bills (in Indian Rupees INR)
let utilityBills: UtilityBill[] = [
  {
    id: 1,
    bill_number: 'BILL-FAC-BLR-01-202609',
    facility_id: 1,
    billing_month: 'September 2026',
    billing_period_start: '2026-09-01',
    billing_period_end: '2026-09-30',
    units_consumed_kwh: 78500,
    peak_demand_recorded_kw: 480,
    sanctioned_load_kw: 650,
    energy_rate_applied: 8.65,
    energy_charges_inr: 679025.0,
    fixed_demand_charges_inr: 193375.0,
    fuel_surcharge_inr: 43175.0,
    solar_rebate_inr: 15400.0,
    taxes_inr: 81015.75,
    total_amount_inr: 981190.75,
    due_date: '2026-10-15',
    payment_status: 'paid',
    paid_date: '2026-10-10',
  },
  {
    id: 2,
    bill_number: 'BILL-FAC-PUN-02-202609',
    facility_id: 2,
    billing_month: 'September 2026',
    billing_period_start: '2026-09-01',
    billing_period_end: '2026-09-30',
    units_consumed_kwh: 142000,
    peak_demand_recorded_kw: 980,
    sanctioned_load_kw: 1200,
    energy_rate_applied: 7.8,
    energy_charges_inr: 1107600.0,
    fixed_demand_charges_inr: 428400.0,
    fuel_surcharge_inr: 68160.0,
    solar_rebate_inr: 28000.0,
    taxes_inr: 118212.0,
    total_amount_inr: 1694372.0,
    due_date: '2026-11-05',
    payment_status: 'pending',
  },
  {
    id: 3,
    bill_number: 'BILL-FAC-NCR-03-202609',
    facility_id: 3,
    billing_month: 'September 2026',
    billing_period_start: '2026-09-01',
    billing_period_end: '2026-09-30',
    units_consumed_kwh: 34500,
    peak_demand_recorded_kw: 240,
    sanctioned_load_kw: 350,
    energy_rate_applied: 8.2,
    energy_charges_inr: 282900.0,
    fixed_demand_charges_inr: 104125.0,
    fuel_surcharge_inr: 18975.0,
    solar_rebate_inr: 7200.0,
    taxes_inr: 35892.0,
    total_amount_inr: 434692.0,
    due_date: '2026-10-25',
    payment_status: 'paid',
    paid_date: '2026-10-22',
  },
  {
    id: 4,
    bill_number: 'BILL-FAC-CHN-04-202609',
    facility_id: 4,
    billing_month: 'September 2026',
    billing_period_start: '2026-09-01',
    billing_period_end: '2026-09-30',
    units_consumed_kwh: 92000,
    peak_demand_recorded_kw: 620,
    sanctioned_load_kw: 850,
    energy_rate_applied: 8.5,
    energy_charges_inr: 782000.0,
    fixed_demand_charges_inr: 252875.0,
    fuel_surcharge_inr: 50600.0,
    solar_rebate_inr: 18500.0,
    taxes_inr: 96027.75,
    total_amount_inr: 1163002.75,
    due_date: '2026-10-18',
    payment_status: 'overdue',
  },
  {
    id: 5,
    bill_number: 'BILL-FAC-HYD-05-202609',
    facility_id: 5,
    billing_month: 'September 2026',
    billing_period_start: '2026-09-01',
    billing_period_end: '2026-09-30',
    units_consumed_kwh: 58000,
    peak_demand_recorded_kw: 340,
    sanctioned_load_kw: 400,
    energy_rate_applied: 8.9,
    energy_charges_inr: 516200.0,
    fixed_demand_charges_inr: 119000.0,
    fuel_surcharge_inr: 31900.0,
    solar_rebate_inr: 0.0,
    taxes_inr: 60039.0,
    total_amount_inr: 727139.0,
    due_date: '2026-11-10',
    payment_status: 'pending',
  },
];

// Seed Energy Alerts
let energyAlerts: EnergyAlert[] = [
  {
    id: 1,
    facility_id: 2,
    meter_id: 7,
    alert_title: 'Low Power Factor (0.86 PF) on Heavy Press Line A',
    alert_type: 'low_power_factor',
    severity: 'critical',
    description: 'Production Line A motor capacitor bank failed, causing lagging power factor below statutory 0.90 DISCOM threshold.',
    recommendation: 'Replace degraded APFC capacitor steps to avoid 2% monthly reactive power billing penalty.',
    timestamp: new Date(now.getTime() - 3.5 * 3600000).toISOString(),
    is_resolved: false,
  },
  {
    id: 2,
    facility_id: 1,
    meter_id: 3,
    alert_title: 'Night-Time Baseload Leak (38 kW) in HVAC System',
    alert_type: 'night_baseload_leak',
    severity: 'warning',
    description: 'HVAC Chiller remained active at 38 kW during unoccupied facility hours (02:00 - 05:00 AM).',
    recommendation: 'Verify building automation system (BAS) setback schedule and inspect motorized bypass damper seals.',
    timestamp: new Date(now.getTime() - 14 * 3600000).toISOString(),
    is_resolved: false,
  },
  {
    id: 3,
    facility_id: 5,
    meter_id: 12,
    alert_title: 'Peak Demand Exceedance Warning (340 kW / 400 kW)',
    alert_type: 'peak_demand_exceeded',
    severity: 'warning',
    description: 'Simultaneous compressor pull-down pushed demand to 85% of sanctioned contract load.',
    recommendation: 'Stagger ammonia compressor start sequences to prevent contract demand surcharge.',
    timestamp: new Date(now.getTime() - 28 * 3600000).toISOString(),
    is_resolved: false,
  },
  {
    id: 4,
    facility_id: 1,
    meter_id: 2,
    alert_title: 'Solar Inverter 2 Dust Soiling Degradation (-12% Yield)',
    alert_type: 'solar_underperformance',
    severity: 'info',
    description: 'Rooftop string yield degraded by 12% relative to pyranometer solar irradiance measurements.',
    recommendation: 'Schedule robotic dry brush cleaning cycle for Tech Park array B.',
    timestamp: new Date(now.getTime() - 52 * 3600000).toISOString(),
    is_resolved: true,
    resolved_at: new Date(now.getTime() - 20 * 3600000).toISOString(),
    resolved_by: 'Priya Nair',
  },
];

// Current Auth User session
let currentUser = {
  id: 1,
  username: 'admin',
  email: 'admin@greengrid.io',
  role: 'super_admin' as 'super_admin' | 'facility_manager' | 'viewer',
  first_name: 'Aditya',
  last_name: 'Sharma',
  department: 'Executive Energy Operations',
};

// -------------------------------------------------------------
// REST API ROUTES
// -------------------------------------------------------------

// Auth Routes
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (username === 'manager') {
    currentUser = {
      id: 2,
      username: 'manager',
      email: 'manager@greengrid.io',
      role: 'facility_manager',
      first_name: 'Priya',
      last_name: 'Nair',
      department: 'Facility Operations',
    };
  } else if (username === 'viewer') {
    currentUser = {
      id: 3,
      username: 'viewer',
      email: 'viewer@greengrid.io',
      role: 'viewer',
      first_name: 'Rohan',
      last_name: 'Verma',
      department: 'Sustainability Audit',
    };
  } else {
    currentUser = {
      id: 1,
      username: 'admin',
      email: 'admin@greengrid.io',
      role: 'super_admin',
      first_name: 'Aditya',
      last_name: 'Sharma',
      department: 'Executive Energy Operations',
    };
  }

  res.json({
    access: 'jwt-greengrid-valid-token-session',
    refresh: 'jwt-greengrid-valid-refresh-token',
    user: currentUser,
  });
});

app.get('/api/auth/profile', (req: Request, res: Response) => {
  res.json(currentUser);
});

app.post('/api/auth/switch-role', (req: Request, res: Response) => {
  const { role } = req.body;
  if (['super_admin', 'facility_manager', 'viewer'].includes(role)) {
    currentUser.role = role;
    if (role === 'facility_manager') {
      currentUser.username = 'manager';
      currentUser.first_name = 'Priya';
      currentUser.last_name = 'Nair';
    } else if (role === 'viewer') {
      currentUser.username = 'viewer';
      currentUser.first_name = 'Rohan';
      currentUser.last_name = 'Verma';
    } else {
      currentUser.username = 'admin';
      currentUser.first_name = 'Aditya';
      currentUser.last_name = 'Sharma';
    }
  }
  res.json(currentUser);
});

// Facilities Routes
app.get('/api/facilities', (req: Request, res: Response) => {
  const data = facilities.map((f) => {
    const fMeters = meters.filter((m) => m.facility_id === f.id);
    return {
      ...f,
      meters_count: fMeters.length,
      active_load_kw: Math.round(f.connected_load_kw * 0.72),
    };
  });
  res.json(data);
});

app.post('/api/facilities', (req: Request, res: Response) => {
  const newFacility: Facility = {
    id: facilities.length + 1,
    name: req.body.name || 'New Facility',
    facility_code: req.body.facility_code || `FAC-${Date.now().toString().slice(-4)}`,
    address: req.body.address || 'Industrial Area',
    city: req.body.city || 'Bengaluru',
    state: req.body.state || 'Karnataka',
    facility_type: req.body.facility_type || 'commercial_office',
    floor_area_sqm: Number(req.body.floor_area_sqm) || 10000,
    connected_load_kw: Number(req.body.connected_load_kw) || 250,
    solar_capacity_kw: Number(req.body.solar_capacity_kw) || 50,
    operational_status: req.body.operational_status || 'operational',
    manager_name: req.body.manager_name || currentUser.first_name + ' ' + currentUser.last_name,
    manager_email: req.body.manager_email || currentUser.email,
    created_at: new Date().toISOString(),
  };
  facilities.push(newFacility);
  res.status(201).json(newFacility);
});

app.put('/api/facilities/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const idx = facilities.findIndex((f) => f.id === id);
  if (idx !== -1) {
    facilities[idx] = { ...facilities[idx], ...req.body };
    res.json(facilities[idx]);
  } else {
    res.status(404).json({ error: 'Facility not found' });
  }
});

app.delete('/api/facilities/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  facilities = facilities.filter((f) => f.id !== id);
  res.json({ message: 'Facility deleted successfully' });
});

// Meters Routes
app.get('/api/meters', (req: Request, res: Response) => {
  const { facility, energy_source, meter_type } = req.query;
  let result = [...meters];
  if (facility) result = result.filter((m) => m.facility_id === Number(facility));
  if (energy_source) result = result.filter((m) => m.energy_source === energy_source);
  if (meter_type) result = result.filter((m) => m.meter_type === meter_type);

  const populated = result.map((m) => {
    const fac = facilities.find((f) => f.id === m.facility_id);
    return {
      ...m,
      facility_name: fac?.name || 'Unknown',
      facility_code: fac?.facility_code || '',
    };
  });
  res.json(populated);
});

app.post('/api/meters', (req: Request, res: Response) => {
  const newMeter: Meter = {
    id: meters.length + 1,
    meter_code: req.body.meter_code || `MTR-${Date.now().toString().slice(-4)}`,
    name: req.body.name || 'Sub-Meter',
    facility_id: Number(req.body.facility_id) || 1,
    meter_type: req.body.meter_type || 'grid_main',
    energy_source: req.body.energy_source || 'grid',
    installation_date: new Date().toISOString().slice(0, 10),
    status: req.body.status || 'active',
    location: req.body.location || 'Main Panel',
    rated_voltage_v: Number(req.body.rated_voltage_v) || 415,
    rated_capacity_kw: Number(req.body.rated_capacity_kw) || 100,
  };
  const reading = generateMeterReading(newMeter, new Date());
  newMeter.latest_reading = reading;
  meters.push(newMeter);
  readings.push(reading);
  res.status(201).json(newMeter);
});

app.get('/api/meters/:id/readings', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const limit = Number(req.query.limit) || 50;
  const meterReadings = readings
    .filter((r) => r.meter_id === id)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
  res.json(meterReadings);
});

// Smart Meter Simulation Trigger
app.post('/api/meters/simulate_all', (req: Request, res: Response) => {
  const currentInstant = new Date();
  const generated: MeterReading[] = [];

  for (const m of meters) {
    if (m.status === 'active') {
      const r = generateMeterReading(m, currentInstant);
      m.latest_reading = r;
      readings.push(r);
      generated.push(r);

      // Rule check for alert generation
      if (r.power_factor < 0.88 && !energyAlerts.some((a) => a.meter_id === m.id && !a.is_resolved)) {
        energyAlerts.unshift({
          id: energyAlerts.length + 1,
          facility_id: m.facility_id,
          meter_id: m.id,
          alert_title: `Low Power Factor (${r.power_factor}) on ${m.name}`,
          alert_type: 'low_power_factor',
          severity: 'critical',
          description: `Telemetry detected power factor ${r.power_factor} below 0.90 threshold.`,
          recommendation: 'Check APFC capacitor bank stages and replace degraded capacitors.',
          timestamp: currentInstant.toISOString(),
          is_resolved: false,
        });
      }
    }
  }

  res.json({
    message: `Generated real-time telemetry for ${generated.length} meters.`,
    timestamp: currentInstant.toISOString(),
    count: generated.length,
  });
});

// Analytics Routes
app.get('/api/analytics/overview', (req: Request, res: Response) => {
  const facilityId = req.query.facility ? Number(req.query.facility) : null;
  const days = req.query.days ? Number(req.query.days) : 30;

  let filteredMeters = meters;
  if (facilityId) filteredMeters = meters.filter((m) => m.facility_id === facilityId);

  const meterIds = new Set(filteredMeters.map((m) => m.id));
  const relevantReadings = readings.filter((r) => meterIds.has(r.meter_id));

  let gridKwh = 0;
  let solarKwh = 0;
  let peakKw = 0;

  for (const r of relevantReadings) {
    const m = meters.find((meter) => meter.id === r.meter_id);
    if (m?.energy_source === 'solar') {
      solarKwh += r.energy_kwh;
    } else {
      gridKwh += r.energy_kwh;
    }
    if (r.power_kw > peakKw) peakKw = r.power_kw;
  }

  // Multiply by days scaling factor if database has daily sample snapshots
  const scale = 24 * (days / 30);
  const totalGridKwh = Math.round(gridKwh * scale);
  const totalSolarKwh = Math.round(solarKwh * scale);
  const totalConsumptionKwh = totalGridKwh + totalSolarKwh;

  const renewablePct = totalConsumptionKwh > 0 ? Math.round((totalSolarKwh / totalConsumptionKwh) * 1000) / 10 : 0;
  const emissionFactor = 0.82; // kg CO2e / kWh
  const carbonEmissionsKg = Math.round(totalGridKwh * emissionFactor);
  const avoidedEmissionsKg = Math.round(totalSolarKwh * emissionFactor);

  // Commercial / Industrial electricity tariff in INR (average ₹8.40 / kWh)
  const totalCostInr = Math.round(totalGridKwh * 8.4);
  const energySavingsPct = 14.8;

  res.json({
    total_consumption_kwh: totalConsumptionKwh,
    grid_consumption_kwh: totalGridKwh,
    solar_generated_kwh: totalSolarKwh,
    renewable_percentage: renewablePct,
    peak_demand_kw: Math.round(peakKw * 1.15),
    total_cost_inr: totalCostInr,
    carbon_emissions_kg: carbonEmissionsKg,
    avoided_emissions_kg: avoidedEmissionsKg,
    emission_factor: emissionFactor,
    energy_savings_pct: energySavingsPct,
    active_meters: filteredMeters.length,
    active_facilities: facilityId ? 1 : facilities.length,
  });
});

app.get('/api/analytics/facility-comparison', (req: Request, res: Response) => {
  const result = facilities.map((f) => {
    const fMeters = meters.filter((m) => m.facility_id === f.id);
    const mIds = new Set(fMeters.map((m) => m.id));
    const fReadings = readings.filter((r) => mIds.has(r.meter_id));

    let grid = 0;
    let solar = 0;
    for (const r of fReadings) {
      const m = meters.find((meter) => meter.id === r.meter_id);
      if (m?.energy_source === 'solar') solar += r.energy_kwh;
      else grid += r.energy_kwh;
    }

    const scale = 24;
    const totalKwh = Math.round((grid + solar) * scale);
    const intensity = Math.round((totalKwh / f.floor_area_sqm) * 100) / 100;

    return {
      facility_id: f.id,
      name: f.name,
      code: f.facility_code,
      type: f.facility_type.replace('_', ' ').toUpperCase(),
      floor_area_sqm: f.floor_area_sqm,
      grid_consumption_kwh: Math.round(grid * scale),
      solar_generated_kwh: Math.round(solar * scale),
      total_kwh: totalKwh,
      energy_intensity_kwh_sqm: intensity,
      solar_capacity_kw: f.solar_capacity_kw,
      status: f.operational_status,
      cost_inr: Math.round(grid * scale * 8.4),
    };
  });
  res.json(result);
});

// Time series trends (24-hour diurnal load & 30-day history)
app.get('/api/analytics/timeseries', (req: Request, res: Response) => {
  // 24 Hour load curve for today
  const hours = [
    '00:00', '02:00', '04:00', '06:00', '08:00', '10:00',
    '12:00', '14:00', '16:00', '18:00', '20:00', '22:00',
  ];

  const hourlyLoad = hours.map((hourStr, idx) => {
    const h = idx * 2;
    // Work shift curve
    const isShift = h >= 8 && h <= 18;
    const baseGrid = isShift ? 180 + Math.sin(idx) * 35 : 65 + Math.random() * 15;
    // Solar peak around noon (10:00 to 16:00)
    let solar = 0;
    if (h >= 6 && h <= 18) {
      solar = Math.round(110 * Math.exp(-0.5 * Math.pow((h - 13) / 2.8, 2)));
    }
    return {
      time: hourStr,
      grid_kw: Math.round(baseGrid),
      solar_kw: Math.round(solar),
      total_kw: Math.round(baseGrid + solar),
    };
  });

  // Past 30 Days trend
  const dailyHistory = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 3600000);
    const dayLabel = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const gridKwh = isWeekend ? 3800 + Math.random() * 400 : 7800 + Math.random() * 900;
    const solarKwh = 2400 + Math.random() * 500;
    dailyHistory.push({
      date: dayLabel,
      grid_kwh: Math.round(gridKwh),
      solar_kwh: Math.round(solarKwh),
      total_kwh: Math.round(gridKwh + solarKwh),
      cost_inr: Math.round(gridKwh * 8.4),
    });
  }

  res.json({
    hourly_load: hourlyLoad,
    daily_history: dailyHistory,
  });
});

// Utility Bills Routes
app.get('/api/bills', (req: Request, res: Response) => {
  const { facility, status } = req.query;
  let result = [...utilityBills];
  if (facility) result = result.filter((b) => b.facility_id === Number(facility));
  if (status) result = result.filter((b) => b.payment_status === status);

  const populated = result.map((b) => {
    const fac = facilities.find((f) => f.id === b.facility_id);
    return {
      ...b,
      facility_name: fac?.name || 'Unknown',
      facility_code: fac?.facility_code || '',
      cost_per_kwh: Math.round((b.total_amount_inr / b.units_consumed_kwh) * 100) / 100,
    };
  });
  res.json(populated);
});

app.post('/api/bills', (req: Request, res: Response) => {
  const facId = Number(req.body.facility_id) || 1;
  const fac = facilities.find((f) => f.id === facId);
  const units = Number(req.body.units_consumed_kwh) || 50000;
  const rate = Number(req.body.energy_rate_applied) || 8.5;
  const peakKw = Number(req.body.peak_demand_recorded_kw) || 300;
  const fixedRate = 380;

  const energyCharges = Math.round(units * rate);
  const fixedCharges = Math.round(peakKw * fixedRate);
  const fuelSurcharge = Math.round(units * 0.5);
  const solarRebate = Number(req.body.solar_rebate_inr) || 0;
  const subtotal = Math.max(0, energyCharges + fixedCharges + fuelSurcharge - solarRebate);
  const taxes = Math.round(subtotal * 0.09);
  const total = subtotal + taxes;

  const newBill: UtilityBill = {
    id: utilityBills.length + 1,
    bill_number: `BILL-${fac?.facility_code || 'FAC'}-${Date.now().toString().slice(-4)}`,
    facility_id: facId,
    billing_month: req.body.billing_month || 'October 2026',
    billing_period_start: req.body.billing_period_start || '2026-10-01',
    billing_period_end: req.body.billing_period_end || '2026-10-31',
    units_consumed_kwh: units,
    peak_demand_recorded_kw: peakKw,
    sanctioned_load_kw: fac?.connected_load_kw || 500,
    energy_rate_applied: rate,
    energy_charges_inr: energyCharges,
    fixed_demand_charges_inr: fixedCharges,
    fuel_surcharge_inr: fuelSurcharge,
    solar_rebate_inr: solarRebate,
    taxes_inr: taxes,
    total_amount_inr: total,
    due_date: req.body.due_date || '2026-11-20',
    payment_status: 'pending',
  };

  utilityBills.unshift(newBill);
  res.status(201).json(newBill);
});

app.post('/api/bills/:id/mark_paid', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const bill = utilityBills.find((b) => b.id === id);
  if (bill) {
    bill.payment_status = 'paid';
    bill.paid_date = new Date().toISOString().slice(0, 10);
    res.json({ message: 'Bill marked as paid', bill });
  } else {
    res.status(404).json({ error: 'Bill not found' });
  }
});

// Renewable Energy Routes
app.get('/api/renewable', (req: Request, res: Response) => {
  const populated = renewableSystems.map((s) => {
    const fac = facilities.find((f) => f.id === s.facility_id);
    return {
      ...s,
      facility_name: fac?.name || '',
      facility_code: fac?.facility_code || '',
    };
  });
  res.json(populated);
});

app.get('/api/renewable/metrics', (req: Request, res: Response) => {
  const totalCapacity = renewableSystems.reduce((acc, s) => acc + s.solar_capacity_kw, 0);
  const totalBattery = renewableSystems.reduce((acc, s) => acc + s.battery_capacity_kwh, 0);
  const totalGen = Math.round(renewableSystems.reduce((acc, s) => acc + s.generation_today_kwh, 0) * 10) / 10;
  const totalExport = Math.round(renewableSystems.reduce((acc, s) => acc + s.exported_today_kwh, 0) * 10) / 10;
  const totalSelf = Math.round(renewableSystems.reduce((acc, s) => acc + s.self_consumed_today_kwh, 0) * 10) / 10;
  const avgSoc = Math.round((renewableSystems.reduce((acc, s) => acc + s.battery_soc_pct, 0) / renewableSystems.length) * 10) / 10;

  res.json({
    total_solar_capacity_kw: totalCapacity,
    total_battery_capacity_kwh: totalBattery,
    total_solar_generation_today_kwh: totalGen,
    total_self_consumed_today_kwh: totalSelf,
    total_exported_today_kwh: totalExport,
    average_battery_soc_pct: avgSoc,
  });
});

// Energy Alerts Routes
app.get('/api/alerts', (req: Request, res: Response) => {
  const { severity, resolved, facility } = req.query;
  let result = [...energyAlerts];
  if (severity) result = result.filter((a) => a.severity === severity);
  if (resolved !== undefined) {
    const isRes = resolved === 'true';
    result = result.filter((a) => a.is_resolved === isRes);
  }
  if (facility) result = result.filter((a) => a.facility_id === Number(facility));

  const populated = result.map((a) => {
    const fac = facilities.find((f) => f.id === a.facility_id);
    const m = meters.find((meter) => meter.id === a.meter_id);
    return {
      ...a,
      facility_name: fac?.name || '',
      facility_code: fac?.facility_code || '',
      meter_name: m?.name || 'Facility Level',
    };
  });
  res.json(populated);
});

app.post('/api/alerts/:id/resolve', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const alert = energyAlerts.find((a) => a.id === id);
  if (alert) {
    alert.is_resolved = true;
    alert.resolved_at = new Date().toISOString();
    alert.resolved_by = currentUser.first_name + ' ' + currentUser.last_name;
    res.json({ message: 'Alert resolved successfully', alert });
  } else {
    res.status(404).json({ error: 'Alert not found' });
  }
});

// AI Assistant Routes (Google Gemini API Integration with Fallback)
app.post('/api/ai/chat', async (req: Request, res: Response) => {
  const { question } = req.body;
  if (!question) {
    res.status(400).json({ error: 'Question is required' });
    return;
  }

  // Compile live database summary context
  const contextSummary = {
    facilities: facilities.map((f) => ({
      name: f.name,
      code: f.facility_code,
      type: f.facility_type,
      connected_load_kw: f.connected_load_kw,
      solar_capacity_kw: f.solar_capacity_kw,
      area_sqm: f.floor_area_sqm,
    })),
    total_active_alerts: energyAlerts.filter((a) => !a.is_resolved).length,
    bills_summary: utilityBills.map((b) => ({
      facility: facilities.find((f) => f.id === b.facility_id)?.name,
      month: b.billing_month,
      kwh: b.units_consumed_kwh,
      total_inr: b.total_amount_inr,
      status: b.payment_status,
    })),
    currency: 'INR (₹)',
    grid_emission_factor: '0.82 kg CO2e/kWh',
  };

  const systemInstruction = `You are GreenGrid AI – Chief Energy Engineer and Sustainability Auditor for enterprise facilities.
You evaluate smart meter readings, peak demand, power factor penalties, Time-of-Day (TOD) tariffs in INR, solar self-consumption, and carbon emissions.
Active Facility Context:
${JSON.stringify(contextSummary, null, 2)}

Instructions:
1. Provide practical, high-value energy engineering insights.
2. Calculate estimated ₹ savings and kWh reductions wherever relevant.
3. Structure your response with clean Markdown headers and clear bullet points.
4. Keep the response crisp, professional, and directly answer the question.`;

  if (genAI) {
    try {
      const response = await genAI.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `${systemInstruction}\n\nUser Question: ${question}`,
      });
      res.json({
        answer: response.text || 'Analysis complete.',
        source: 'Google Gemini 3.8 Flash',
        status: 'success',
      });
      return;
    } catch (err: any) {
      console.warn('Gemini API call failed, falling back to GreenGrid rule engine:', err?.message || err);
    }
  }

  // Rule-based energy intelligence fallback
  const qLower = question.toLowerCase();
  let answer = '';

  if (qLower.includes('bill') || qLower.includes('increase') || qLower.includes('cost')) {
    answer = `### Utility Billing & Cost Surge Analysis

Based on our utility billing records across facilities:
1. **Demand Charges Exceedance:** **Metro Cold Chain Terminal** recorded peak demand reaching 340 kW against a sanctioned load of 400 kW, increasing the fixed demand slab.
2. **Time-of-Day (TOD) Peak Hour Penalty:** Approximately 38% of heavy machinery consumption occurred between 18:00 and 22:00, attracting peak energy tariff rates (₹10.90/kWh vs base ₹7.80/kWh).
3. **Recommended Actions:**
   - Pre-cool cold storage chambers to -22°C during solar hours (11:00 - 15:00) and coast during peak evening hours (18:00 - 22:00).
   - Expected monthly savings: **₹48,500 (~5,800 kWh shifted)**.`;
  } else if (qLower.includes('facility') && (qLower.includes('most') || qLower.includes('highest'))) {
    answer = `### Highest Energy Consuming Facility Evaluation

**Solar Manufacturing Plant 4 (Chakan)** is currently the highest consumer:
- **Monthly Consumption:** 142,000 kWh (Total Bill: ₹16,94,372).
- **Energy Intensity:** 3.16 kWh/m² (or ~142 kWh/m²/year), which is 24% higher than industrial light fabrication benchmarks.
- **Key Driver:** Heavy Press Machine Line A has a low power factor (0.86), drawing excessive reactive kVAR and triggering an active alert.
- **Optimization:** Replacing the degraded capacitor bank steps on the APFC panel will bring power factor back to $\\ge 0.96$, avoiding a 2% DISCOM penalty.`;
  } else if (qLower.includes('solar') || qLower.includes('renewable')) {
    answer = `### Renewable Solar Energy Contribution Report

- **Total Solar Capacity Installed:** 540 kWp across 4 active facilities.
- **Current Renewable Contribution:** 28.4% of total organizational energy requirements.
- **Avoided Carbon Emissions:** ~89.5 Metric Tons CO₂e saved per month.
- **Net-Metering Export:** Surpluses generated on Sundays (averaging 680 kWh/day) are exported back to the grid at ₹3.50/kWh feed-in tariff.
- **Recommendation:** Greenfield Logistics Hub has 4,200 m² of unutilized warehouse roof space that can support an additional 250 kWp solar PV system, projecting an annual saving of ₹18.4 Lakhs.`;
  } else if (qLower.includes('abnormal') || qLower.includes('alert')) {
    answer = `### Active Anomaly & Alert Summary

Currently, **3 active anomalies** require attention:
1. **Critical:** Low Power Factor (0.86 PF) on Heavy Press Line A at Chakan Plant.
2. **Warning:** Night-time Baseload Leak (38 kW) in Tech Park HVAC Chiller between 02:00 and 05:00 AM.
3. **Warning:** Peak Demand approaching 85% at Metro Cold Chain Terminal.
- **Prioritized Fix:** Address the HVAC chiller nocturnal leak first; automating a setback schedule yields immediate net savings of **₹32,000/month**.`;
  } else {
    answer = `### GreenGrid Energy Audit Insight

In response to your query regarding: **"${question}"**

1. **Energy Baseload Audit:** Our anomaly detection identified that Academic Campus and Corporate HQ maintain an aggregate night-time baseload of 64 kW between 01:00 and 05:00. Scheduling smart HVAC setpoint rollbacks to 26°C can immediately recover **₹26,000/month**.
2. **Power Factor Optimization:** Ensure APFC capacitor steps are functioning to avoid statutory state DISCOM surcharges.
3. **Peak Demand Management:** Interlock non-essential loads (EV chargers, water pumping) with smart meter demand controllers to prevent exceeding contracted kVA.`;
  }

  res.json({
    answer,
    source: 'GreenGrid Energy Intelligence Engine',
    status: 'success',
  });
});

app.get('/api/ai/recommendations', (req: Request, res: Response) => {
  res.json([
    {
      id: 1,
      title: 'HVAC Night Baseload Temperature Setback',
      facility: 'Corporate Tech Park HQ',
      category: 'HVAC & Thermal',
      estimated_savings_inr: 38000,
      kwh_reduction: 4500,
      roi_months: 1.2,
      priority: 'high',
      action: 'Automate thermostat setback from 22°C to 26°C between 20:00 and 06:00 during unoccupied hours.',
    },
    {
      id: 2,
      title: 'APFC Capacitor Replacement for PF Correction',
      facility: 'Solar Manufacturing Plant 4',
      category: 'Power Quality',
      estimated_savings_inr: 52000,
      kwh_reduction: 6200,
      roi_months: 3.5,
      priority: 'critical',
      action: 'Replace 50 kVAR degraded capacitor step to bring power factor from 0.86 back to 0.98 and avoid DISCOM penalties.',
    },
    {
      id: 3,
      title: 'Rooftop Solar Expansion (250 kWp)',
      facility: 'Greenfield Logistics Hub',
      category: 'Renewable Energy',
      estimated_savings_inr: 155000,
      kwh_reduction: 28500,
      roi_months: 36.0,
      priority: 'medium',
      action: 'Utilize 4,200 sq.m unshaded roof for grid-tied solar PV with net metering export.',
    },
    {
      id: 4,
      title: 'Pre-Cooling Thermal Shift for Cold Storage Chilling',
      facility: 'Metro Cold Chain Terminal',
      category: 'Load Shifting & TOD',
      estimated_savings_inr: 46000,
      kwh_reduction: 5400,
      roi_months: 0.5,
      priority: 'high',
      action: 'Pre-cool chambers during peak solar hours (11:00-14:00) and coast during peak tariff hours (18:00-22:00).',
    },
  ]);
});

// Reports Export CSV Route
app.get('/api/reports/export', (req: Request, res: Response) => {
  const type = req.query.type || 'billing';
  let csv = '';

  if (type === 'billing') {
    csv = 'Bill Number,Facility,Month,Units (kWh),Rate (INR),Total Amount (INR),Status\n';
    for (const b of utilityBills) {
      const fac = facilities.find((f) => f.id === b.facility_id);
      csv += `"${b.bill_number}","${fac?.name}","${b.billing_month}",${b.units_consumed_kwh},${b.energy_rate_applied},${b.total_amount_inr},"${b.payment_status}"\n`;
    }
  } else if (type === 'facilities') {
    csv = 'Facility Name,Code,Type,Floor Area (sq.m),Connected Load (kW),Solar Capacity (kW),Status\n';
    for (const f of facilities) {
      csv += `"${f.name}","${f.facility_code}","${f.facility_type}",${f.floor_area_sqm},${f.connected_load_kw},${f.solar_capacity_kw},"${f.operational_status}"\n`;
    }
  } else {
    csv = 'Meter Code,Meter Name,Voltage (V),Current (A),Power (kW),Energy (kWh),Power Factor,Simulated\n';
    for (const r of readings.slice(-50)) {
      const m = meters.find((meter) => meter.id === r.meter_id);
      csv += `"${m?.meter_code}","${m?.name}",${r.voltage_v},${r.current_a},${r.power_kw},${r.energy_kwh},${r.power_factor},${r.is_simulated}\n`;
    }
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=greengrid_${type}_report.csv`);
  res.send(csv);
});

// -------------------------------------------------------------
// VITE MIDDLEWARE SETUP FOR FULL-STACK SPA DEVELOPMENT
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GreenGrid EMIS server is active and listening on port ${PORT}`);
  });
}

startServer();
