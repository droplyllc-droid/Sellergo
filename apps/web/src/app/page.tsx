import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Check, ShoppingCart, TrendingUp, Users, Zap } from 'lucide-react';

const features = [
  {
    icon: ShoppingCart,
    title: 'COD Optimized',
    description: 'Built specifically for Cash on Delivery markets in Tunisia and North Africa.',
  },
  {
    icon: TrendingUp,
    title: 'Advanced Analytics',
    description: 'Track orders, revenue, confirmation rates, and delivery performance in real-time.',
  },
  {
    icon: Users,
    title: 'Customer Management',
    description: 'Manage customers, block fraudsters, and track repeat buyers effortlessly.',
  },
  {
    icon: Zap,
    title: 'Pixel Integration',
    description: 'Connect Meta, TikTok, Snapchat pixels with Conversions API support.',
  },
];

const pricing = [
  {
    name: 'Pay As You Go',
    price: '0.27%',
    period: 'per order',
    description: 'Only pay when you make sales',
    features: [
      'Unlimited products',
      'Unlimited orders',
      'All features included',
      'No monthly fees',
    ],
    highlighted: true,
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="fixed top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
              Sellergo
            </span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/features" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Features
            </Link>
            <Link href="/pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Pricing
            </Link>
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm">
                Start Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto text-center">
          <div className="inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-medium mb-8">
            <span className="text-primary">New:</span>
            <span className="ml-2 text-muted-foreground">TikTok Pixel with Conversions API</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            E-commerce Platform for
            <span className="block bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
              COD Markets
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Launch your online store in minutes. Built specifically for Tunisia and North Africa
            with COD optimization, advanced analytics, and pixel tracking.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto">
                Start Selling Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/demo">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                View Demo
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            No credit card required. Only 0.27% per order.
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Everything You Need to Sell Online</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              From order management to pixel tracking, we&apos;ve got you covered.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature) => (
              <div key={feature.title} className="bg-background rounded-lg p-6 shadow-sm border">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              No monthly fees. Only pay when you make sales.
            </p>
          </div>
          <div className="max-w-md mx-auto">
            {pricing.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl p-8 ${
                  plan.highlighted
                    ? 'bg-gradient-to-br from-primary/5 to-blue-600/5 border-2 border-primary'
                    : 'bg-background border'
                }`}
              >
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">/{plan.period}</span>
                </div>
                <p className="text-muted-foreground mb-6">{plan.description}</p>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/register">
                  <Button className="w-full" size="lg">
                    Get Started
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Start Selling?</h2>
          <p className="max-w-2xl mx-auto mb-8 text-primary-foreground/80">
            Join thousands of sellers using Sellergo to grow their business in Tunisia and beyond.
          </p>
          <Link href="/register">
            <Button size="lg" variant="secondary">
              Create Your Store
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center space-x-2">
              <span className="text-xl font-bold">Sellergo</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Sellergo. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground">
                Privacy
              </Link>
              <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground">
                Terms
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
