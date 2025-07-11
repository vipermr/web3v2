import express from 'express';

const router = express.Router();

// About Me page route
router.get('/nafij', (req, res) => {
  const aboutPageHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>About Nafij - Full Stack Developer</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }
        
        .hero {
            text-align: center;
            margin-bottom: 4rem;
            animation: fadeInUp 0.8s ease-out;
        }
        
        .avatar {
            width: 150px;
            height: 150px;
            border-radius: 50%;
            background: linear-gradient(135deg, #3b82f6, #1d4ed8);
            margin: 0 auto 2rem;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 4rem;
            color: white;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            animation: float 3s ease-in-out infinite;
        }
        
        .hero h1 {
            font-size: 3.5rem;
            font-weight: 700;
            color: white;
            margin-bottom: 1rem;
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .hero p {
            font-size: 1.25rem;
            color: rgba(255,255,255,0.9);
            margin-bottom: 2rem;
            max-width: 600px;
            margin-left: auto;
            margin-right: auto;
        }
        
        .status-badges {
            display: flex;
            justify-content: center;
            gap: 1rem;
            flex-wrap: wrap;
            margin-bottom: 2rem;
        }
        
        .badge {
            background: rgba(255,255,255,0.2);
            backdrop-filter: blur(10px);
            padding: 0.5rem 1rem;
            border-radius: 25px;
            color: white;
            font-size: 0.875rem;
            font-weight: 500;
            border: 1px solid rgba(255,255,255,0.3);
        }
        
        .badge.available {
            background: rgba(34, 197, 94, 0.2);
            border-color: rgba(34, 197, 94, 0.5);
        }
        
        .content-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 2rem;
            margin-bottom: 3rem;
        }
        
        .card {
            background: rgba(255,255,255,0.95);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 2rem;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            animation: fadeInUp 0.8s ease-out;
        }
        
        .card:hover {
            transform: translateY(-5px);
            box-shadow: 0 20px 40px rgba(0,0,0,0.15);
        }
        
        .card h2 {
            font-size: 1.5rem;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .icon {
            width: 24px;
            height: 24px;
            background: linear-gradient(135deg, #3b82f6, #1d4ed8);
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 14px;
        }
        
        .skills-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 0.75rem;
            margin-top: 1rem;
        }
        
        .skill-tag {
            background: linear-gradient(135deg, #f3f4f6, #e5e7eb);
            padding: 0.5rem 0.75rem;
            border-radius: 8px;
            font-size: 0.875rem;
            font-weight: 500;
            text-align: center;
            color: #374151;
            transition: all 0.2s ease;
        }
        
        .skill-tag:hover {
            background: linear-gradient(135deg, #3b82f6, #1d4ed8);
            color: white;
            transform: scale(1.05);
        }
        
        .project {
            background: linear-gradient(135deg, #f8fafc, #f1f5f9);
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 1rem;
            border-left: 4px solid #3b82f6;
            transition: all 0.3s ease;
        }
        
        .project:hover {
            background: linear-gradient(135deg, #eff6ff, #dbeafe);
            transform: translateX(5px);
        }
        
        .project h3 {
            font-size: 1.125rem;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 0.5rem;
        }
        
        .project p {
            color: #6b7280;
            font-size: 0.875rem;
            margin-bottom: 0.75rem;
        }
        
        .project-tags {
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;
        }
        
        .project-tag {
            background: #3b82f6;
            color: white;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 500;
        }
        
        .contact-links {
            display: flex;
            justify-content: center;
            gap: 1rem;
            flex-wrap: wrap;
        }
        
        .contact-link {
            background: rgba(255,255,255,0.2);
            backdrop-filter: blur(10px);
            color: white;
            text-decoration: none;
            padding: 0.75rem 1.5rem;
            border-radius: 12px;
            font-weight: 500;
            transition: all 0.3s ease;
            border: 1px solid rgba(255,255,255,0.3);
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .contact-link:hover {
            background: rgba(255,255,255,0.3);
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.1);
        }
        
        .cta {
            text-align: center;
            margin-top: 3rem;
            animation: fadeInUp 0.8s ease-out 0.4s both;
        }
        
        .cta h2 {
            font-size: 2rem;
            font-weight: 600;
            color: white;
            margin-bottom: 1rem;
        }
        
        .cta p {
            font-size: 1.125rem;
            color: rgba(255,255,255,0.9);
            margin-bottom: 2rem;
        }
        
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        @keyframes float {
            0%, 100% {
                transform: translateY(0px);
            }
            50% {
                transform: translateY(-10px);
            }
        }
        
        @media (max-width: 768px) {
            .container {
                padding: 1rem;
            }
            
            .hero h1 {
                font-size: 2.5rem;
            }
            
            .content-grid {
                grid-template-columns: 1fr;
            }
            
            .status-badges {
                flex-direction: column;
                align-items: center;
            }
            
            .contact-links {
                flex-direction: column;
                align-items: center;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="hero">
            <div class="avatar">👨‍💻</div>
            <h1>Nafij Rahman</h1>
            <p>Full Stack Developer & API Architect specializing in modern web technologies and scalable backend solutions</p>
            
            <div class="status-badges">
                <div class="badge available">🟢 Available for Projects</div>
                <div class="badge">📍 Remote Worldwide</div>
                <div class="badge">⚡ 3+ Years Experience</div>
            </div>
        </div>
        
        <div class="content-grid">
            <div class="card">
                <h2><span class="icon">💻</span>Technical Expertise</h2>
                <p>Passionate about creating robust, scalable applications with modern technologies</p>
                
                <h3 style="margin-top: 1.5rem; margin-bottom: 0.5rem; color: #374151;">Frontend Development</h3>
                <div class="skills-grid">
                    <div class="skill-tag">React</div>
                    <div class="skill-tag">TypeScript</div>
                    <div class="skill-tag">Next.js</div>
                    <div class="skill-tag">Tailwind CSS</div>
                    <div class="skill-tag">Vite</div>
                    <div class="skill-tag">JavaScript</div>
                </div>
                
                <h3 style="margin-top: 1.5rem; margin-bottom: 0.5rem; color: #374151;">Backend Development</h3>
                <div class="skills-grid">
                    <div class="skill-tag">Node.js</div>
                    <div class="skill-tag">Express.js</div>
                    <div class="skill-tag">MongoDB</div>
                    <div class="skill-tag">PostgreSQL</div>
                    <div class="skill-tag">REST APIs</div>
                    <div class="skill-tag">JWT Auth</div>
                </div>
                
                <h3 style="margin-top: 1.5rem; margin-bottom: 0.5rem; color: #374151;">Tools & DevOps</h3>
                <div class="skills-grid">
                    <div class="skill-tag">Git</div>
                    <div class="skill-tag">Docker</div>
                    <div class="skill-tag">AWS</div>
                    <div class="skill-tag">Render</div>
                    <div class="skill-tag">Vercel</div>
                    <div class="skill-tag">Linux</div>
                </div>
            </div>
            
            <div class="card">
                <h2><span class="icon">🚀</span>Featured Projects</h2>
                <p>Some of my recent work showcasing different aspects of full-stack development</p>
                
                <div class="project">
                    <h3>Express.js Form Backend API</h3>
                    <p>Production-ready form submission API with Gmail integration, security features, and beautiful email templates. Currently live and processing real submissions.</p>
                    <div class="project-tags">
                        <div class="project-tag">Express.js</div>
                        <div class="project-tag">Gmail API</div>
                        <div class="project-tag">Security</div>
                        <div class="project-tag">Rate Limiting</div>
                    </div>
                </div>
                
                <div class="project">
                    <h3>Web3 Portfolio Platform</h3>
                    <p>Modern portfolio website with interactive UI, responsive design, and optimized performance. Built with React and deployed on Render.</p>
                    <div class="project-tags">
                        <div class="project-tag">React</div>
                        <div class="project-tag">TypeScript</div>
                        <div class="project-tag">Tailwind</div>
                        <div class="project-tag">Responsive</div>
                    </div>
                </div>
                
                <div class="project">
                    <h3>Database Management System</h3>
                    <p>Full-stack application with CRUD operations, user authentication, and real-time updates. Scalable architecture with modern best practices.</p>
                    <div class="project-tags">
                        <div class="project-tag">MongoDB</div>
                        <div class="project-tag">JWT</div>
                        <div class="project-tag">Real-time</div>
                        <div class="project-tag">CRUD</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="cta">
            <h2>Let's Build Something Amazing Together</h2>
            <p>I'm always excited to work on new projects and collaborate with fellow developers</p>
            
            <div class="contact-links">
                <a href="mailto:nafij@example.com" class="contact-link">
                    📧 Email Me
                </a>
                <a href="https://github.com/nafij" class="contact-link" target="_blank">
                    🐙 GitHub
                </a>
                <a href="https://linkedin.com/in/nafij" class="contact-link" target="_blank">
                    💼 LinkedIn
                </a>
                <a href="/" class="contact-link">
                    🏠 Back to API
                </a>
            </div>
        </div>
    </div>
</body>
</html>
  `;

  res.send(aboutPageHTML);
});

export default router;