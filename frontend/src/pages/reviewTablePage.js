import React from 'react';
import ReviewTable from '../components/reviewTable'
import Footer from '../components/footer';
import ResponsiveAppBar from '../components/navbarNew';



// Function for showing information pages on post graduate programme

function AppointmentPage(){

    return(


        <div>
                <div style={{marginBottom: '100px'}}>
                    <ResponsiveAppBar/>
                </div>

                <div>
                    <ReviewTable/>
                </div>

                <div style={{marginTop: '10px'}}>
                    <Footer/>
                </div>
                

            </div>

    )
}

export default AppointmentPage;