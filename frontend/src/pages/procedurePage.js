import React from 'react';
import AppProcedure from '../components/infoPages/procedure';
import Footer from '../components/footer';
import ResponsiveAppBar from '../components/navbarNew';


// Function for showing information pages on post graduate programme

function ProcedurePage(){

    return(


        <div>
                <div style={{marginBottom: '100px'}}>
                    <ResponsiveAppBar/>
                </div>

                <div>
                    <AppProcedure/>
                </div>

                <div style={{marginTop: '10px'}}>
                    <Footer/>
                </div>
                

            </div>

    )
}

export default ProcedurePage;