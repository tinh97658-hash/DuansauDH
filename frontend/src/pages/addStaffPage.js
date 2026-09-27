import React from 'react';
import Footer from '../components/footer';
import ResponsiveAppBar from '../components/navbarNew';
import AddStaff from '../components/addStaff';


// Function for showing information pages on post graduate programme

function AddStaffPage(){

    return(


        <div>
                <div style={{marginBottom: '100px'}}>
                    <ResponsiveAppBar/>
                </div>

                <div>
                    <AddStaff/>
                </div>

                <div style={{marginTop: '10px'}}>
                    <Footer/>
                </div>
                

            </div>

    )
}

export default AddStaffPage;
