document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("joinForm");
    
    // IMAGE ELEMENTS
    const templateImg = document.getElementById("cert-template");
    const logoLeft = document.getElementById("logo-left");
    const logoRight = document.getElementById("logo-right");

    // *** PASTE YOUR GOOGLE SCRIPT URL HERE ***
    const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw79MNRHGLUMKbnQHKHAoPu6DNGuuB79QS3kUfp3VIVfJ-B4vtDCJiqB1AQ-RBmXVumTw/exec"; 

    if (!form || !templateImg) {
        console.error("Error: Required elements missing.");
        return;
    }

    form.addEventListener("submit", async function (e) {
        e.preventDefault();

        // 1. GET ALL USER DATA
        const rawName = document.getElementById("full-name").value || "Jacktone Omollah";
        // We use "N/A" just in case the input is missing from your HTML
        const regNumber = document.getElementById("reg-number") ? document.getElementById("reg-number").value : "N/A";
        const phoneNumber = document.getElementById("phone-number") ? document.getElementById("phone-number").value : "N/A";

        // 2. SEND TO GOOGLE SHEETS (Background Task)
        // We fire this off immediately so it saves while the PDF is generating
        const formData = {
            name: rawName,
            regNumber: regNumber,
            phoneNumber: phoneNumber
        };

        fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors", // This is crucial for Google Scripts
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData)
        }).catch(err => console.log("Database Error:", err));


        // 3. GENERATE CERTIFICATE
        // (This is your exact existing code below)
        
        // Wait for the sexy font
        await document.fonts.load('10px "Great Vibes"');

        if (!window.jspdf) {
            alert("Error: jsPDF library is missing.");
            return;
        }

        try {
            const canvas = document.createElement("canvas");
            const w = templateImg.naturalWidth;
            const h = templateImg.naturalHeight;
            canvas.width = w;
            canvas.height = h;
            
            const ctx = canvas.getContext("2d");

            // Draw Template
            ctx.drawImage(templateImg, 0, 0);

            // Draw Logos (Optional)
            const logoSize = w * 0.12;
            const logoY = h * 0.05;
            const logoMargin = w * 0.05;

            if (logoLeft) ctx.drawImage(logoLeft, logoMargin, logoY, logoSize, logoSize);
            if (logoRight) ctx.drawImage(logoRight, w - logoSize - logoMargin, logoY, logoSize, logoSize);

            // Common Settings
            const centerX = w / 2;
            ctx.textAlign = "center";
            ctx.fillStyle = "#014421"; // Egerton Green

            // --- A. DRAW CLUB TITLE ---
            const titleSize = w * 0.032; 
            ctx.font = `bold ${titleSize}px Helvetica`; 
            // Position: 8% down from top
            ctx.fillText("EGERTON UNIVERSITY CHEMISTRY CLUB", centerX, h * 0.08);


            // --- B. DRAW STUDENT NAME ---
            // Capitalization Logic
            let titleCaseName = rawName
                .toLowerCase()
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');

            // Spacing Logic
            const finalName = titleCaseName.trim().replace(/\s+/g, "    "); 
            
            // Draw it
            const nameSize = w * 0.085; 
            ctx.font = `${nameSize}px 'Great Vibes'`;
            
            // Position: 57% down from top
            ctx.fillText(finalName, centerX, h * 0.57);


            // 4. Generate PDF
            const imgData = canvas.toDataURL("image/png");
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({
                orientation: "landscape",
                unit: "mm",
                format: "a4"
            });

            const pdfWidth = doc.internal.pageSize.getWidth();
            const pdfHeight = doc.internal.pageSize.getHeight();

            doc.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
            
            // Use a clean filename
            const safeName = titleCaseName.replace(/[^a-zA-Z0-9]/g, "_");
            doc.save(`${safeName}_Certificate.pdf`);

            // --- F. WHATSAPP REDIRECT ---
            setTimeout(() => {
                // REPLACE THIS LINK with your actual WhatsApp Group Invite Link
                window.location.href = "https://chat.whatsapp.com/YOUR_ACTUAL_INVITE_CODE_HERE";
            }, 2000);

        } catch (error) {
            console.error("Generation Failed:", error);
            alert("Error generating PDF. Check console.");
        }
    });
});