import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

interface Resource {
  _id: string;
  title: string;
  description: string;
  category: string;
  images: string[];
  donor: {
    name: string;
    profilePicture?: string;
  };
  location: {
    city: string;
  };
  createdAt: string;
}

interface Stats {
  totalUsers: number;
  totalResources: number;
  totalImpacts: number;
}

export default function Home() {
  const router = useRouter();
  const [featuredResources, setFeaturedResources] = useState<Resource[]>([]);
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalResources: 0, totalImpacts: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHomeData();
  }, []);

  const fetchHomeData = async () => {
    try {
      // Fetch featured resources
      const resourcesResponse = await fetch('/api/resources?limit=6');
      if (resourcesResponse.ok) {
        const resourcesData = await resourcesResponse.json();
        setFeaturedResources(resourcesData.resources || []);
      }

      // Fetch community stats
      const statsResponse = await fetch('/api/impact/community');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats({
          totalUsers: statsData.totalUsers || 0,
          totalResources: statsData.totalResources || 0,
          totalImpacts: statsData.totalImpacts || 0
        });
      }
    } catch (error) {
      console.error('Error fetching home data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Community Aid Platform - Connecting Communities Through Kindness</title>
        <meta name="description" content="A platform connecting community members to share resources and services, building stronger communities through technology." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center">
                <h1 className="text-2xl font-bold text-blue-600">Community Aid</h1>
              </div>
              <nav className="hidden md:flex space-x-8">
                <Link href="/resources" className="text-gray-700 hover:text-blue-600 transition-colors">
                  Browse Resources
                </Link>
                <Link href="/challenges" className="text-gray-700 hover:text-blue-600 transition-colors">
                  Challenges
                </Link>
                <Link href="/about" className="text-gray-700 hover:text-blue-600 transition-colors">
                  About
                </Link>
              </nav>
              <div className="flex items-center space-x-4">
                <Link
                  href="/auth/login"
                  className="text-gray-700 hover:text-blue-600 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/register"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
            <div className="text-center">
              <h2 className="text-4xl md:text-6xl font-bold mb-6">
                Building Stronger Communities
              </h2>
              <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto">
                Connect with your neighbors to share resources, offer services, and create positive impact in your community.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/auth/register"
                  className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
                >
                  Join Community
                </Link>
                <Link
                  href="/resources"
                  className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition-colors"
                >
                  Browse Resources
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-4xl font-bold text-blue-600 mb-2">
                  {loading ? '...' : stats.totalUsers.toLocaleString()}
                </div>
                <div className="text-gray-600">Community Members</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-green-600 mb-2">
                  {loading ? '...' : stats.totalResources.toLocaleString()}
                </div>
                <div className="text-gray-600">Resources Shared</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-purple-600 mb-2">
                  {loading ? '...' : stats.totalImpacts.toLocaleString()}
                </div>
                <div className="text-gray-600">Lives Impacted</div>
              </div>
            </div>
          </div>
        </section>

        {/* Featured Resources */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h3 className="text-3xl font-bold text-center mb-12">Featured Resources</h3>
            {loading ? (
              <div className="text-center text-gray-600">Loading resources...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {featuredResources.map((resource) => (
                  <div key={resource._id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="h-48 bg-gray-200 flex items-center justify-center">
                      {resource.images && resource.images.length > 0 ? (
                        <img
                          src={resource.images[0]}
                          alt={resource.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-gray-400">No image</div>
                      )}
                    </div>
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {resource.category}
                        </span>
                        <span className="text-sm text-gray-500">
                          {resource.location?.city}
                        </span>
                      </div>
                      <h4 className="text-xl font-semibold mb-2">{resource.title}</h4>
                      <p className="text-gray-600 mb-4 line-clamp-2">{resource.description}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-gray-300 rounded-full mr-2"></div>
                          <span className="text-sm text-gray-600">{resource.donor.name}</span>
                        </div>
                        <Link
                          href={`/resources/${resource._id}`}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View Details
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="text-center mt-12">
              <Link
                href="/resources"
                className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                View All Resources
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h3 className="text-3xl font-bold text-center mb-12">How It Works</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h4 className="text-xl font-semibold mb-2">Share Resources</h4>
                <p className="text-gray-600">Post items you want to donate or services you can offer to help your community.</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h4 className="text-xl font-semibold mb-2">Find What You Need</h4>
                <p className="text-gray-600">Browse available resources in your area and connect with generous community members.</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h4 className="text-xl font-semibold mb-2">Build Community</h4>
                <p className="text-gray-600">Create lasting connections and make a positive impact in your neighborhood.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-800 text-white py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div>
                <h5 className="text-lg font-semibold mb-4">Community Aid</h5>
                <p className="text-gray-400">
                  Connecting communities through kindness and shared resources.
                </p>
              </div>
              <div>
                <h6 className="font-semibold mb-4">Platform</h6>
                <ul className="space-y-2 text-gray-400">
                  <li><Link href="/resources" className="hover:text-white">Browse Resources</Link></li>
                  <li><Link href="/challenges" className="hover:text-white">Challenges</Link></li>
                  <li><Link href="/impact" className="hover:text-white">Impact</Link></li>
                </ul>
              </div>
              <div>
                <h6 className="font-semibold mb-4">Community</h6>
                <ul className="space-y-2 text-gray-400">
                  <li><Link href="/about" className="hover:text-white">About Us</Link></li>
                  <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
                  <li><Link href="/help" className="hover:text-white">Help Center</Link></li>
                </ul>
              </div>
              <div>
                <h6 className="font-semibold mb-4">Legal</h6>
                <ul className="space-y-2 text-gray-400">
                  <li><Link href="/privacy" className="hover:text-white">Privacy Policy</Link></li>
                  <li><Link href="/terms" className="hover:text-white">Terms of Service</Link></li>
                </ul>
              </div>
            </div>
            <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
              <p>&copy; 2024 Community Aid Platform. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}