---
layout: home
permalink: index.html

# Please update this with your repository name and title
repository-name: eYY-XXX-project-template
title:
---

[comment]: # "This is the standard layout for the project, but you can clean this and use your own template"

# Postgraduate Student Management System
![s](https://user-images.githubusercontent.com/73387606/176441317-5bc0ae9e-75ff-4313-b2f0-fdfe32851b7b.png)

## Table of Contents
1. [Problem](#problem)
2. [Solution](#solution)
3. [Technology Stack](#technology-stack)
4. [High Level System Organization](#high-level-system-organization)
5. [Data Flow through the system](#data-flow-through-the-system)
6. [Project Repository](#project-repo)
7. [Team](#team)
8. [Links](#links)

## Problem

* Currently the system we use for managing the postgraduate students is not suitable , because the system is not user friendly.

   ![Screenshot_2022-06-29_151736-removebg-preview](https://user-images.githubusercontent.com/73387606/176407296-fbc7a165-0cdf-4a07-961f-e01787952b34.png)
   
* Submission and processing delays (Synchronization effects with submissions)
* Difficulties in managing multiple platforms
* Delaying graduation and program completion.
* There should be a place to publish the students' reports and thesis.   

## Solution

* So we decided to implement interactive <code><i>Web Application</i></code>. This system consists of ,
    * Student Registration System
         * The main role is to register users on the system and store their sensitive information in the database 
         * Secure than G-sheets
         * Easy to manage user data (G-sheets, G-forms replaced)
    * User Management Facility System
         * Different user roles, only the admin can  Insert, delete and update data
    * Progress and Performance Monitorin System
         * Allows supervisors, and examiners to monitor the progress of the students
         * Coordinators can get a better idea about students' performance
         * Also students can get an idea about their progress in postgraduate program
    * Automated Event Management System
         * A most important part G-Sheets and G-forms can't do automated events
         * It- Easier for coordinators to get a reminder as well as students
         * Automated Email and Notification System is developed in this part
         * This prevents submission and processing delays
         
## Technology Stack

![Screenshot 2022-06-29 185918](https://user-images.githubusercontent.com/73387606/176448500-d963a59a-89cf-4df7-a3c4-7a316e9b20cb.png)

* ReactJS
   * Improves the quality of user interface
   * Open source and easy to use
   * Less coding and gives more functionality
   * Performance Enhancement by using virtual DOM

* Express JS
   * Can handle a higher level of requests efficiently
   * Can integrate several third-party applications and services with ExpressJS.
   * fast application development in a limited time
 
* PostgreSQL
   * Relational schema with foreign keys and database-level constraints
   * Versioned migrations and transactional data operations
   
## High Level System Organization

![High level system organization](https://user-images.githubusercontent.com/73387606/176453629-4b1eec86-ef3d-4722-9095-bbf61464a7fb.png)

   
## Data Flow through the system

![cpu](https://user-images.githubusercontent.com/73387606/176451868-4e8175ca-6f47-42fb-9f2c-0c5a65f517a2.jpg)

## Project Repo
   * [Project Repo](https://github.com/cepdnaclk/e18-co227-Postgraduate-Student-Management-System)
   * [Kanban Board](https://github.com/cepdnaclk/e18-co227-Postgraduate-Student-Management-System/projects/1?fullscreen=true)


## Team
-  E/18/028, Ariyawansha P.H.J.U., [e18028@eng.pdn.ac.lk](mailto:name@email.com)
-  E/18/173, Kasthuripitiya K.A.I.M., [e18173@eng.pdn.ac.lk](mailto:name@email.com)
-  E/18/285, Ranasinghe S.M.T.S.C., [e18285@eng.pdn.ac.lk](mailto:name@email.com)

## Links

- [Project Repository](https://github.com/cepdnaclk/{{ page.repository-name }}){:target="_blank"}
- [Project Page](https://cepdnaclk.github.io/{{ page.repository-name}}){:target="_blank"}
- [Department of Computer Engineering](http://www.ce.pdn.ac.lk/)
- [University of Peradeniya](https://eng.pdn.ac.lk/)


[//]: # (Please refer this to learn more about Markdown syntax)
[//]: # (https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet)
