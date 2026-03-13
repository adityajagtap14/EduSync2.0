import './globals.css';

export const metadata = {
  title: 'EduSync | Faculty Activity & Compliance Tracker',
  description: 'Track faculty workload, ensure NBA/NAAC compliance, and manage departmental resource allocation with AI-powered insights.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
