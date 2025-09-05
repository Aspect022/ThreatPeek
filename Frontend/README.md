# ThreatPeek Frontend Dashboard 🌐

A modern, responsive web dashboard built with Next.js and React, providing an intuitive interface for cybersecurity threat monitoring, analysis, and management.

## 🎯 Overview

The Frontend Dashboard serves as the primary user interface for ThreatPeek, offering:

- **Real-time Threat Monitoring**: Live dashboards with threat status and analytics
- **Interactive Analysis Tools**: User-friendly interfaces for security scanning
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Modern UI Components**: Built with Radix UI and Tailwind CSS
- **Dark/Light Themes**: Customizable appearance preferences
- **Real-time Updates**: Live data feeds and notifications

## 🛠️ Technology Stack

- **Framework**: Next.js 14+ (React 18+)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI primitives
- **Icons**: Lucide React
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod validation
- **Animations**: Framer Motion
- **State Management**: React Context/Hooks
- **Authentication**: Next-Auth (if implemented)

## 📦 Key Dependencies

### Core Framework
```json
{
  "next": "14.2.16",
  "react": "^18",
  "react-dom": "^18",
  "typescript": "^5"
}
```

### UI & Styling
```json
{
  "@radix-ui/react-*": "Various components",
  "tailwindcss": "^4.1.9",
  "lucide-react": "^0.454.0",
  "framer-motion": "^12.23.12",
  "class-variance-authority": "^0.7.1"
}
```

### Forms & Validation
```json
{
  "react-hook-form": "^7.60.0",
  "@hookform/resolvers": "^3.10.0",
  "zod": "3.25.67"
}
```

### Charts & Data Visualization
```json
{
  "recharts": "2.15.4"
}
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18 or higher
- npm or yarn

### Installation

1. **Navigate to Frontend directory**
   ```bash
   cd Frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Environment Setup**
   Create a `.env.local` file:
   ```env
   # API Configuration
   NEXT_PUBLIC_API_URL=http://localhost:3000
   NEXT_PUBLIC_WS_URL=ws://localhost:3000
   
   # App Configuration
   NEXT_PUBLIC_APP_NAME=ThreatPeek
   NEXT_PUBLIC_APP_VERSION=1.0.0
   
   # Analytics (if enabled)
   NEXT_PUBLIC_ANALYTICS_ID=your_analytics_id
   
   # External Services
   NEXT_PUBLIC_STEGO_SERVICE_URL=http://localhost:8000
   ```

### Running the Application

#### Development Mode
```bash
npm run dev
# App runs at http://localhost:3000 (or next available port)
```

#### Production Build
```bash
npm run build
npm start
```

#### Linting & Formatting
```bash
npm run lint
npm run lint:fix
```

## 📋 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Create production build
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues automatically
- `npm run type-check` - Run TypeScript type checking

## 🏗️ Project Structure

```
Frontend/
├── 📂 app/                   # Next.js App Router
│   ├── 📄 globals.css       # Global styles
│   ├── 📄 layout.tsx        # Root layout component
│   ├── 📄 page.tsx          # Home page
│   ├── 📂 dashboard/        # Dashboard pages
│   ├── 📂 scan/             # Scanning interfaces
│   ├── 📂 alerts/           # Alert management
│   ├── 📂 settings/         # Configuration pages
│   └── 📂 api/              # API routes (if used)
├── 📂 components/           # Reusable UI components
│   ├── 📂 ui/               # Base UI components (Radix)
│   ├── 📂 dashboard/        # Dashboard-specific components
│   ├── 📂 forms/            # Form components
│   ├── 📂 charts/           # Chart components
│   └── 📂 layout/           # Layout components
├── 📂 lib/                  # Utility functions
│   ├── 📄 utils.ts          # General utilities
│   ├── 📄 api.ts            # API client
│   ├── 📄 validations.ts    # Zod schemas
│   └── 📄 constants.ts      # App constants
├── 📂 hooks/                # Custom React hooks
│   ├── 📄 use-api.ts        # API hooks
│   ├── 📄 use-auth.ts       # Authentication hooks
│   └── 📄 use-theme.ts      # Theme management
├── 📂 types/                # TypeScript type definitions
├── 📂 styles/               # Additional styles
├── 📂 public/               # Static assets
│   ├── 📂 images/           # Images and icons
│   └── 📂 icons/            # App icons
├── 📄 next.config.js        # Next.js configuration
├── 📄 tailwind.config.js    # Tailwind CSS configuration
├── 📄 components.json       # shadcn/ui configuration
└── 📄 tsconfig.json         # TypeScript configuration
```

## 🎨 UI Components

### Core Components
Built with Radix UI primitives for accessibility and customization:

- **Navigation**: Sidebar, breadcrumbs, menus
- **Data Display**: Tables, cards, badges, avatars
- **Feedback**: Alerts, toasts, loading states
- **Overlay**: Modals, popovers, tooltips
- **Forms**: Input fields, select boxes, checkboxes
- **Charts**: Real-time data visualization

### Component Examples

#### Dashboard Card
```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function ThreatMetricCard({ title, value, trend }: ThreatMetricProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">
          {trend > 0 ? '+' : ''}{trend}% from last hour
        </p>
      </CardContent>
    </Card>
  )
}
```

#### Threat Analysis Form
```tsx
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form"

const scanSchema = z.object({
  type: z.enum(['image', 'text', 'url']),
  content: z.string().min(1, 'Content is required'),
  options: z.object({
    deepScan: z.boolean().default(false),
    includeMetadata: z.boolean().default(true)
  })
})

function ScanForm() {
  const form = useForm({
    resolver: zodResolver(scanSchema)
  })

  return (
    <Form {...form}>
      {/* Form fields */}
    </Form>
  )
}
```

## 🎭 Theming & Styling

### Dark/Light Mode
Supports system preference and manual toggle:

```tsx
// Theme provider setup
import { ThemeProvider } from "next-themes"

function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

### Tailwind Configuration
```js
// tailwind.config.js
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Custom color palette for cybersecurity theme
        threat: {
          low: "hsl(var(--threat-low))",
          medium: "hsl(var(--threat-medium))",
          high: "hsl(var(--threat-high))",
          critical: "hsl(var(--threat-critical))"
        }
      }
    }
  }
}
```

## 📊 Dashboard Features

### Real-time Monitoring
- **Live Threat Feed**: Real-time threat detection updates
- **System Status**: Service health and connectivity status
- **Alert Dashboard**: Active alerts and notification management
- **Analytics**: Threat trends and statistical analysis

### Interactive Scanning
- **File Upload**: Drag-and-drop interface for image analysis
- **URL Scanner**: Real-time website security assessment
- **Batch Processing**: Multiple file analysis capability
- **Results Visualization**: Interactive charts and reports

### User Management
- **Authentication**: Secure login and session management
- **Profile Settings**: User preferences and configuration
- **Role-based Access**: Permission-based feature access
- **Activity Logs**: User action tracking and audit trails

## 🔌 API Integration

### HTTP Client Configuration
```tsx
// lib/api.ts
import axios from 'axios'

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
})

// Request interceptor for auth tokens
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth-token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default apiClient
```

### Custom API Hooks
```tsx
// hooks/use-api.ts
import useSWR from 'swr'
import { apiClient } from '@/lib/api'

export function useThreatData() {
  const { data, error, isLoading } = useSWR(
    '/api/threats',
    (url) => apiClient.get(url).then(res => res.data)
  )

  return {
    threats: data,
    isLoading,
    isError: error,
    mutate
  }
}
```

## 🔄 State Management

### Context Providers
```tsx
// contexts/threat-context.tsx
const ThreatContext = createContext<ThreatContextType | undefined>(undefined)

export function ThreatProvider({ children }: { children: React.ReactNode }) {
  const [threats, setThreats] = useState<Threat[]>([])
  const [alertLevel, setAlertLevel] = useState<AlertLevel>('low')

  return (
    <ThreatContext.Provider value={{ threats, alertLevel, setAlertLevel }}>
      {children}
    </ThreatContext.Provider>
  )
}
```

## 🧪 Testing

### Testing Setup
```bash
# Install testing dependencies
npm install --save-dev jest @testing-library/react @testing-library/jest-dom

# Run tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Example Component Test
```tsx
// __tests__/components/ThreatCard.test.tsx
import { render, screen } from '@testing-library/react'
import { ThreatCard } from '@/components/dashboard/ThreatCard'

describe('ThreatCard', () => {
  it('renders threat information correctly', () => {
    const mockThreat = {
      id: '1',
      type: 'malware',
      severity: 'high',
      confidence: 0.95
    }

    render(<ThreatCard threat={mockThreat} />)
    
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getByText('95%')).toBeInTheDocument()
  })
})
```

## 🚀 Deployment

### Vercel Deployment (Recommended)
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to Vercel
vercel

# Production deployment
vercel --prod
```

### Docker Deployment
```dockerfile
# Dockerfile
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS builder
WORKDIR /app
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]
```

### Static Export
```bash
# For static hosting
npm run build
npm run export
```

## ⚡ Performance Optimization

### Next.js Optimizations
- **Image Optimization**: Next.js Image component
- **Code Splitting**: Automatic route-based splitting
- **Static Generation**: ISR for dynamic content
- **Bundle Analysis**: Webpack bundle analyzer

### Performance Monitoring
```tsx
// lib/analytics.ts
import { Analytics } from '@vercel/analytics/react'

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Analytics />
    </>
  )
}
```

## 🔒 Security Considerations

- **Content Security Policy**: Configured in next.config.js
- **Environment Variables**: Proper secret management
- **Input Sanitization**: Client-side validation with Zod
- **XSS Protection**: React's built-in protection
- **Authentication**: Secure session management

## 🛟 Troubleshooting

### Common Issues

**Build Errors**
```bash
# Clear Next.js cache
rm -rf .next
npm run build
```

**Type Errors**
```bash
# Run type checking
npm run type-check

# Fix common issues
npm run lint:fix
```

**Styling Issues**
```bash
# Rebuild Tailwind
npx tailwindcss -i ./app/globals.css -o ./dist/output.css --watch
```

### Debug Mode
```bash
DEBUG=* npm run dev
```

## 🤝 Contributing

1. Follow the existing component structure and naming conventions
2. Add TypeScript types for all new features
3. Include tests for new components
4. Update Storybook stories for UI components
5. Follow accessibility guidelines (ARIA labels, keyboard navigation)

## 🔮 Future Enhancements

- [ ] Progressive Web App (PWA) support
- [ ] Real-time WebSocket integration
- [ ] Advanced data visualization components
- [ ] Mobile-first responsive improvements
- [ ] Offline functionality
- [ ] Advanced accessibility features
- [ ] Micro-frontend architecture
- [ ] Component library extraction

---

For detailed component documentation and examples, refer to the Storybook instance or individual component files.
