import React from 'react';
import Appointment from '../components/infoPages/appointment';
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
                    <Appointment/>
                </div>

                <div style={{marginTop: '10px'}}>
                    <Footer/>
                </div>
                

            </div>

    )
}

export default AppointmentPage;