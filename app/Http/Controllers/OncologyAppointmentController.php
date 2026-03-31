<?php

namespace App\Http\Controllers;

class OncologyAppointmentController extends AppointmentController
{
    protected string $service = 'oncology';
    protected string $routePrefix = 'admin.oncology-appointments';
    protected string $urlPrefix = '/admin/oncology-appointments';
    protected string $inertiaPage = 'admin/oncology-appointments/index';
    protected string $inertiaViewPage = 'admin/oncology-appointments/view';
    protected string $pageTitle = 'Citas de Oncología';
}
